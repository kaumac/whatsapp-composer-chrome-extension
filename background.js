// Context menu for Google Sheets and other canvas-based apps
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "wpp-send-selection",
    title: 'Enviar "%s" no WhatsApp',
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "wpp-send-selection" && info.selectionText) {
    const text = info.selectionText.trim();
    const digits = text.replace(/\D/g, "");

    let phoneDigits = digits;
    if (digits.startsWith("55") && digits.length >= 12) {
      phoneDigits = digits.slice(2);
    }

    if (phoneDigits.length >= 10 && phoneDigits.length <= 11) {
      chrome.tabs.sendMessage(tab.id, {
        type: "OPEN_COMPOSER",
        phone: phoneDigits,
        text: text
      });
    }
  }
});

function buildWhatsAppLink(phone, message) {
  // Sanitize phone: strip all non-numeric chars
  const digits = phone.replace(/\D/g, "");
  const phoneClean = digits.startsWith("55") ? digits : "55" + digits;

  // WhatsApp treats Unicode line/paragraph separators as invalid characters.
  // Normalize them to regular line feeds before UTF-8 URL encoding. Do not
  // replace U+FFFD: it means the text was already corrupted upstream.
  const cleanMessage = String(message)
    .replace(/\r\n?/g, "\n")
    .replace(/[\u2028\u2029]/g, "\n");

  // Encode properly
  const encoded = encodeURIComponent(cleanMessage);

  // Use the direct send endpoint. The wa.me desktop redirect can decode
  // supplementary Unicode characters (emoji) as U+FFFD.
  return `https://api.whatsapp.com/send/?phone=${phoneClean}&text=${encoded}`;
}

function resolveTemplate(template, name, businessName, region) {
  const h = new Date().getHours();
  let g, G;
  if (h >= 5 && h < 12) { g = "bom dia"; G = "Bom dia"; }
  else if (h >= 12 && h < 18) { g = "boa tarde"; G = "Boa tarde"; }
  else { g = "boa noite"; G = "Boa noite"; }
  return template
    .replace(/\{name\}/g, name || "")
    .replace(/\{Name\}/g, name || "")
    .replace(/\{business_name\}/g, businessName || "")
    .replace(/\{region\}/g, region || "")
    .replace(/\{greeting\}/g, g)
    .replace(/\{Greeting\}/g, G);
}

function autoSendTabKey(tabId) {
  return `wppAutoSendTab_${tabId}`;
}

function autoCloseTabKey(tabId) {
  return `wppAutoCloseTab_${tabId}`;
}

// Message storage
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // The api.whatsapp.com redirect page marks extension-opened tabs before
  // navigating to WhatsApp Web. This keeps auto-send scoped to our own tabs.
  if (message.type === "MARK_AUTO_SEND_TAB") {
    const tabId = sender.tab?.id;
    if (typeof tabId !== "number") {
      sendResponse({ success: false });
      return;
    }

    chrome.storage.session.set({ [autoSendTabKey(tabId)]: true }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // WhatsApp Web asks whether this tab was marked by the redirect script.
  // Consume the marker and authorize a one-time close after sending.
  if (message.type === "GET_AUTO_SEND_TAB") {
    const tabId = sender.tab?.id;
    if (typeof tabId !== "number") {
      sendResponse({ autoSend: false });
      return;
    }

    const key = autoSendTabKey(tabId);
    chrome.storage.session.get(key, (data) => {
      const autoSend = data[key] === true;
      chrome.storage.session.remove(key, () => {
        if (autoSend) {
          chrome.storage.session.set({ [autoCloseTabKey(tabId)]: true });
        }
        sendResponse({ autoSend });
      });
    });
    return true;
  }

  // Close only tabs that completed the extension's auto-send handshake.
  if (message.type === "CLOSE_AUTO_SEND_TAB") {
    const tabId = sender.tab?.id;
    if (typeof tabId !== "number") {
      sendResponse({ success: false });
      return;
    }

    const key = autoCloseTabKey(tabId);
    chrome.storage.session.get(key, (data) => {
      if (data[key] !== true) {
        sendResponse({ success: false });
        return;
      }

      chrome.storage.session.remove(key, () => {
        chrome.tabs.remove(tabId, () => {
          // A tab may already have been closed by the user.
          void chrome.runtime.lastError;
          sendResponse({ success: true });
        });
      });
    });
    return true;
  }

  // Template storage
  if (message.type === "GET_TEMPLATES") {
    chrome.storage.local.get(["customTemplates", "deletedTemplates"], (data) => {
      sendResponse({
        customTemplates: data.customTemplates || [],
        deletedTemplates: data.deletedTemplates || []
      });
    });
    return true;
  }

  if (message.type === "SAVE_TEMPLATE") {
    chrome.storage.local.get(["customTemplates", "deletedTemplates"], (data) => {
      let templates = data.customTemplates || [];
      const deletedTemplates = new Set(data.deletedTemplates || []);
      // Keep individual and business defaults independent from each other.
      if (message.template.isDefault) {
        templates = templates.map(t => ({ ...t, isDefault: false }));
      }
      if (message.template.isBusinessDefault) {
        templates = templates.map(t => ({ ...t, isBusinessDefault: false }));
      }
      // Ensure message preserves Unicode (handle emojis properly)
      const template = { ...message.template };
      // Saving a template with a previously deleted built-in name restores it.
      deletedTemplates.delete(template.name);
      // Check if we're updating an existing template (same name)
      const existingIdx = templates.findIndex(t => t.name === template.name);
      if (existingIdx >= 0) {
        templates[existingIdx] = template;
      } else {
        templates.push(template);
      }
      chrome.storage.local.set({
        customTemplates: templates,
        deletedTemplates: [...deletedTemplates]
      }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (message.type === "DELETE_TEMPLATE") {
    chrome.storage.local.get(["customTemplates", "deletedTemplates"], (data) => {
      const templates = (data.customTemplates || []).filter(
        (t) => t.name !== message.name
      );
      const deletedTemplates = new Set(data.deletedTemplates || []);
      deletedTemplates.add(message.name);
      chrome.storage.local.set({
        customTemplates: templates,
        deletedTemplates: [...deletedTemplates]
      }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  // Schedule a message sequence using WhatsApp send links
  if (message.type === "SCHEDULE_SEQUENCE") {
    const { phone, name, businessName, region, messages, intervalSeconds } = message;
    const sequenceId = `seq_${Date.now()}`;
    // Convert seconds to minutes for Chrome alarms (minimum ~0.5 minutes)
    const delayMinutes = Math.max(intervalSeconds / 60, 0.5);

    chrome.storage.local.get("pendingSequences", (data) => {
      const sequences = data.pendingSequences || {};
      sequences[sequenceId] = {
        phone,
        name,
        businessName,
        region,
        messages,
        intervalSeconds,
        delayMinutes,
        currentIndex: 1, // First message is sent immediately
        createdAt: Date.now()
      };
      chrome.storage.local.set({ pendingSequences: sequences }, () => {
        // Schedule the first follow-up
        if (messages.length > 1) {
          chrome.alarms.create(sequenceId, {
            delayInMinutes: delayMinutes
          });
        }
        sendResponse({ success: true, sequenceId });
      });
    });
    return true;
  }

  // Get pending sequences
  if (message.type === "GET_PENDING_SEQUENCES") {
    chrome.storage.local.get("pendingSequences", (data) => {
      sendResponse({ sequences: data.pendingSequences || {} });
    });
    return true;
  }

  // Cancel a pending sequence
  if (message.type === "CANCEL_SEQUENCE") {
    chrome.alarms.clear(message.sequenceId);
    chrome.storage.local.get("pendingSequences", (data) => {
      const sequences = data.pendingSequences || {};
      delete sequences[message.sequenceId];
      chrome.storage.local.set({ pendingSequences: sequences }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }
});

// Handle alarms for follow-up messages
chrome.alarms.onAlarm.addListener((alarm) => {
  const sequenceId = alarm.name;
  if (!sequenceId.startsWith("seq_")) return;

  chrome.storage.local.get("pendingSequences", (data) => {
    const sequences = data.pendingSequences || {};
    const sequence = sequences[sequenceId];
    if (!sequence) return;

    const { phone, name, businessName, region, messages, delayMinutes, currentIndex } = sequence;

    if (currentIndex < messages.length) {
      const message = resolveTemplate(messages[currentIndex], name, businessName, region);
      const url = buildWhatsAppLink(phone, message);

      // Open the tab with the follow-up message
      chrome.tabs.create({ url });

      // Update the sequence
      sequence.currentIndex++;

      if (sequence.currentIndex < messages.length) {
        // Schedule the next follow-up
        sequences[sequenceId] = sequence;
        chrome.storage.local.set({ pendingSequences: sequences });
        chrome.alarms.create(sequenceId, {
          delayInMinutes: delayMinutes
        });
      } else {
        // Sequence complete, remove it
        delete sequences[sequenceId];
        chrome.storage.local.set({ pendingSequences: sequences });
      }
    }
  });
});
