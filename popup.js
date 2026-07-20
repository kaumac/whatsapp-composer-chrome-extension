(function () {
  "use strict";

  const DEFAULT_TEMPLATES = [
    { name: "Apresentação", message: "Olá {name}, {Greeting}! Meu nome é [seu nome] e gostaria de conversar com você." },
    { name: "Follow-up", message: "Oi {name}! {Greeting}, tudo bem? Gostaria de dar sequência na nossa conversa." },
    { name: "Lembrete", message: "{Greeting} {name}! Este é um lembrete sobre [assunto]." },
  ];

  function getGreeting() {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "bom dia";
    if (h >= 12 && h < 18) return "boa tarde";
    return "boa noite";
  }

  function resolveTemplate(template, name) {
    const g = getGreeting();
    const G = g.charAt(0).toUpperCase() + g.slice(1);
    return template
      .replace(/\{name\}/g, name || "")
      .replace(/\{Name\}/g, name || "")
      .replace(/\{greeting\}/g, g)
      .replace(/\{Greeting\}/g, G);
  }

  function buildWhatsAppLink(phone, message) {
    const digits = phone.replace(/\D/g, "");
    const full = digits.startsWith("55") ? digits : "55" + digits;
    return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
  }

  function formatPhoneBR(v) {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 7) return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
    if (v.length > 2) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
    return v;
  }

  const phoneInput = document.getElementById("phone");
  const nameInput = document.getElementById("name");
  const templateSelect = document.getElementById("template");
  const messageInput = document.getElementById("message");
  const submitBtn = document.getElementById("submit");
  const createLink = document.getElementById("createTemplate");
  const modalOverlay = document.getElementById("modalOverlay");
  const modalClose = document.getElementById("modalClose");
  const tplCancel = document.getElementById("tplCancel");
  const tplSave = document.getElementById("tplSave");
  const tplName = document.getElementById("tplName");
  const tplMsg = document.getElementById("tplMsg");

  let templates = [];

  function populateTemplates() {
    templateSelect.innerHTML = templates.map((t) => `<option value="${t.name}">${t.name}</option>`).join("") + '<option value="__custom__">Personalizar</option>';
    if (templates.length > 0) {
      messageInput.value = templates[0].message;
    }
  }

  function loadTemplates(callback) {
    chrome.runtime.sendMessage({ type: "GET_TEMPLATES" }, (response) => {
      const custom = (response && response.customTemplates) || [];
      templates = [...DEFAULT_TEMPLATES, ...custom];
      populateTemplates();
      if (callback) callback();
    });
  }

  phoneInput.addEventListener("input", () => {
    phoneInput.value = formatPhoneBR(phoneInput.value);
  });

  templateSelect.addEventListener("change", () => {
    if (templateSelect.value === "__custom__") {
      messageInput.value = "";
    } else {
      const t = templates.find((t) => t.name === templateSelect.value);
      if (t) messageInput.value = t.message;
    }
  });

  submitBtn.addEventListener("click", () => {
    const phone = phoneInput.value;
    const name = nameInput.value.trim();
    const message = messageInput.value;
    const resolved = resolveTemplate(message, name);
    chrome.tabs.create({ url: buildWhatsAppLink(phone, resolved) });
  });

  createLink.addEventListener("click", (e) => {
    e.preventDefault();
    modalOverlay.classList.add("active");
    tplName.value = "";
    tplMsg.value = "";
    tplName.focus();
  });

  modalClose.addEventListener("click", () => modalOverlay.classList.remove("active"));
  tplCancel.addEventListener("click", () => modalOverlay.classList.remove("active"));
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) modalOverlay.classList.remove("active");
  });

  tplSave.addEventListener("click", () => {
    const name = tplName.value.trim();
    const message = tplMsg.value.trim();
    if (!name || !message) return;
    chrome.runtime.sendMessage({ type: "SAVE_TEMPLATE", template: { name, message } }, () => {
      loadTemplates(() => {
        templateSelect.value = name;
        messageInput.value = message;
      });
      modalOverlay.classList.remove("active");
    });
  });

  loadTemplates();
})();
