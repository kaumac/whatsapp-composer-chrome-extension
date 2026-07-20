// WhatsApp Web content script - only active when explicitly triggered
(function () {
  "use strict";

  function findMessageInput() {
    const selectors = [
      'div[contenteditable="true"][data-tab="10"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"][data-testid="conversation-compose-box-input"]',
      'div[contenteditable="true"][aria-label*="mensagem"]',
      'div[contenteditable="true"][aria-label*="message"]',
      'div[contenteditable="true"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.closest('[data-testid="conversation-panel-body"]')) return el;
    }
    const all = document.querySelectorAll('div[contenteditable="true"]');
    for (const el of all) {
      if (el.closest('footer') || el.closest('[data-testid="compose"]')) return el;
    }
    return null;
  }

  function findSendButton() {
    const selectors = [
      'button[data-testid="send"]',
      'button[aria-label="Send"]',
      'button[aria-label="Enviar"]',
      'span[data-testid="send"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const svg = btn.querySelector('svg');
      if (svg && btn.closest('footer')) {
        const path = svg.querySelector('path');
        if (path && path.getAttribute('d')?.includes('m15')) {
          return btn;
        }
      }
    }
    return null;
  }

  function waitForElement(selectorFn, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const el = selectorFn();
      if (el) {
        resolve(el);
        return;
      }
      const observer = new MutationObserver(() => {
        const el = selectorFn();
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        reject(new Error("Timeout waiting for element"));
      }, timeout);
    });
  }

  function fillAndSend(message) {
    return new Promise((resolve, reject) => {
      waitForElement(findMessageInput, 15000)
        .then((input) => {
          input.focus();
          input.click();
          input.innerHTML = "";
          const p = document.createElement("p");
          p.textContent = message;
          input.appendChild(p);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));

          setTimeout(() => {
            waitForElement(findSendButton, 5000)
              .then((sendBtn) => {
                setTimeout(() => {
                  sendBtn.click();
                  resolve(true);
                }, 300);
              })
              .catch(() => reject(new Error("Send button not found")));
          }, 500);
        })
        .catch(reject);
    });
  }

  // Listen for messages from background script - only respond when explicitly asked
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "WA_FILL_AND_SEND") {
      fillAndSend(message.text)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (message.type === "WA_FILL_ONLY") {
      waitForElement(findMessageInput, 10000)
        .then((input) => {
          input.focus();
          input.click();
          input.innerHTML = "";
          const p = document.createElement("p");
          p.textContent = message.text;
          input.appendChild(p);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          sendResponse({ success: true });
        })
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }
  });
})();
