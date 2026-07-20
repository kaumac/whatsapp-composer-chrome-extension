// Auto-click "Continue to WhatsApp Web" on api.whatsapp.com redirect page
(function () {
  "use strict";

  function clickContinueButton() {
    // Find the "Continue to WhatsApp Web" link
    const allLinks = document.querySelectorAll('a');
    for (const link of allLinks) {
      if (link.textContent.includes("Continue to WhatsApp Web")) {
        // Remove target="_blank" to open in same tab
        link.removeAttribute("target");
        link.click();
        return true;
      }
    }

    // Fallback: find any element with the text
    const allElements = document.querySelectorAll('a, button, div[role="button"]');
    for (const el of allElements) {
      if (el.textContent.includes("Continue to WhatsApp Web")) {
        if (el.tagName === 'A') {
          el.removeAttribute("target");
        }
        el.click();
        return true;
      }
    }

    // Try finding by href containing web.whatsapp.com
    const waLink = document.querySelector('a[href*="web.whatsapp.com"]');
    if (waLink) {
      // Navigate directly in same tab
      window.location.href = waLink.href;
      return true;
    }

    return false;
  }

  // Try clicking immediately
  if (clickContinueButton()) return;

  // If not found, wait and try again with observer
  const observer = new MutationObserver((mutations) => {
    if (clickContinueButton()) {
      observer.disconnect();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Also try with intervals as fallback
  let attempts = 0;
  const interval = setInterval(() => {
    if (clickContinueButton() || attempts > 20) {
      clearInterval(interval);
      observer.disconnect();
    }
    attempts++;
  }, 500);
})();
