chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TEMPLATES") {
    chrome.storage.local.get("customTemplates", (data) => {
      sendResponse({ customTemplates: data.customTemplates || [] });
    });
    return true;
  }

  if (message.type === "SAVE_TEMPLATE") {
    chrome.storage.local.get("customTemplates", (data) => {
      const templates = data.customTemplates || [];
      templates.push(message.template);
      chrome.storage.local.set({ customTemplates: templates }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (message.type === "DELETE_TEMPLATE") {
    chrome.storage.local.get("customTemplates", (data) => {
      const templates = (data.customTemplates || []).filter(
        (t) => t.name !== message.name
      );
      chrome.storage.local.set({ customTemplates: templates }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }
});
