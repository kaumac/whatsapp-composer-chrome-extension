(function () {
  "use strict";

  const DEFAULT_TEMPLATES = [
    { name: "Apresentação", message: "Olá {name}, {Greeting}! Meu nome é [seu nome] e gostaria de conversar com você.", followups: ["Tudo bem? Gostaria de apresentar nossos serviços.", "Caso tenha interesse, posso enviar mais informações!"], interval: 20 },
    { name: "Follow-up", message: "Oi {name}! {Greeting}, tudo bem? Gostaria de dar sequência na nossa conversa.", followups: [], interval: 20 },
    { name: "Lembrete", message: "{Greeting} {name}! Este é um lembrete sobre [assunto].", followups: [], interval: 20 },
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
    // Sanitize phone: strip all non-numeric chars
    const digits = phone.replace(/\D/g, "");
    const phoneClean = digits.startsWith("55") ? digits : "55" + digits;

    // WhatsApp treats Unicode line/paragraph separators as invalid characters.
    // Normalize them to regular line feeds before UTF-8 URL encoding. Do not
    // replace U+FFFD: it means the text was already corrupted upstream.
    const cleanMessage = String(message)
      .replace(/\r\n?/g, "\n")
      .replace(/[\u2028\u2029]/g, "\n");

    // Encode properly - encodeURIComponent handles:
    //   \n → %0A (WhatsApp honors this)
    //   spaces → %20
    //   & → %26 (prevents breaking URL params)
    //   ? → %3F (prevents breaking URL structure)
    //   Unicode/emoji → proper UTF-8 percent encoding
    const encoded = encodeURIComponent(cleanMessage);

    // Use the direct send endpoint. The wa.me desktop redirect can decode
    // supplementary Unicode characters (emoji) as U+FFFD.
    return `https://api.whatsapp.com/send/?phone=${phoneClean}&text=${encoded}`;
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
  const manageLink = document.getElementById("manageTemplates");
  const modalOverlay = document.getElementById("modalOverlay");
  const modalTitle = document.getElementById("modalTitle");
  const modalClose = document.getElementById("modalClose");
  const tplCancel = document.getElementById("tplCancel");
  const tplSave = document.getElementById("tplSave");
  const tplName = document.getElementById("tplName");
  const tplMsg = document.getElementById("tplMsg");
  const tplFollowup1 = document.getElementById("tplFollowup1");
  const tplFollowup2 = document.getElementById("tplFollowup2");
  const managerOverlay = document.getElementById("managerOverlay");
  const managerClose = document.getElementById("managerClose");
  const managerDone = document.getElementById("managerDone");
  const templateList = document.getElementById("templateList");

  // Sequence elements
  const toggleSequence = document.getElementById("toggleSequence");
  const sequenceFields = document.getElementById("sequenceFields");
  const followup1 = document.getElementById("followup1");
  const followup2 = document.getElementById("followup2");
  const delayMinutes = document.getElementById("delayMinutes");

  let templates = [];
  let editingTemplate = null;
  let sequenceEnabled = false;

  function openModal(overlay) {
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
  }

  function closeModalEl(overlay) {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
  }

  function populateTemplates() {
    templateSelect.innerHTML = templates.map((t) => `<option value="${t.name}" ${t.isDefault ? 'selected' : ''}>${t.name}</option>`).join("") + '<option value="__custom__">Personalizar</option>';
    // Find the default template, or use the first one
    const defaultTpl = templates.find(t => t.isDefault) || templates[0];
    if (defaultTpl) {
      templateSelect.value = defaultTpl.name;
      messageInput.value = defaultTpl.message;
      followup1.value = defaultTpl.followups?.[0] || "";
      followup2.value = defaultTpl.followups?.[1] || "";
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

  function renderManagerList() {
    if (templates.length === 0) {
      templateList.innerHTML = '<p class="text-center text-gray-400 py-5 text-[13px]">Nenhum template criado.</p>';
      return;
    }
    templateList.innerHTML = templates.map((t, i) => `
      <div class="flex items-start justify-between p-3 border border-gray-100 rounded-xl bg-gray-50">
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-[13px] text-gray-900 mb-1">${t.name} ${t.isDefault ? '<span class="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded font-semibold ml-1">Padrão</span>' : ''}</div>
          <div class="text-xs text-gray-500 overflow-hidden text-ellipsis whitespace-nowrap">${t.message}</div>
        </div>
        <div class="flex gap-1.5 ml-3 shrink-0">
          <button class="mgr-edit px-2.5 py-1.5 rounded-md text-[11px] font-semibold cursor-pointer bg-gray-200 text-gray-600 border-none hover:bg-gray-300 transition-colors" data-idx="${i}">Editar</button>
          <button class="mgr-delete px-2.5 py-1.5 rounded-md text-[11px] font-semibold cursor-pointer bg-red-100 text-red-600 border-none hover:bg-red-200 transition-colors" data-idx="${i}">Excluir</button>
        </div>
      </div>
    `).join("");

    templateList.querySelectorAll(".mgr-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx);
        editingTemplate = templates[idx];
        closeModalEl(managerOverlay);
        openCreatorModal(true);
      });
    });

    templateList.querySelectorAll(".mgr-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx);
        const tpl = templates[idx];
        if (confirm(`Excluir template "${tpl.name}"?`)) {
          chrome.runtime.sendMessage({ type: "DELETE_TEMPLATE", name: tpl.name }, () => {
            loadTemplates(() => renderManagerList());
          });
        }
      });
    });
  }

  function openCreatorModal(isEdit) {
    modalTitle.textContent = isEdit ? "Editar Template" : "Criar Template";
    tplName.value = isEdit && editingTemplate ? editingTemplate.name : "";
    tplMsg.value = isEdit && editingTemplate ? editingTemplate.message : "";
    tplFollowup1.value = isEdit && editingTemplate?.followups?.[0] || "";
    tplFollowup2.value = isEdit && editingTemplate?.followups?.[1] || "";
    document.getElementById("tplDefault").checked = isEdit && editingTemplate?.isDefault || false;
    document.getElementById("tplInterval").value = isEdit && editingTemplate?.interval ? editingTemplate.interval : 20;
    openModal(modalOverlay);
    tplName.focus();
  }

  // Sequence toggle
  toggleSequence.addEventListener("click", () => {
    sequenceEnabled = !sequenceEnabled;
    const dot = toggleSequence.querySelector("span");
    if (sequenceEnabled) {
      toggleSequence.classList.remove("bg-gray-300");
      toggleSequence.classList.add("bg-green-500");
      dot.style.transform = "translateX(20px)";
      sequenceFields.classList.remove("hidden");
    } else {
      toggleSequence.classList.remove("bg-green-500");
      toggleSequence.classList.add("bg-gray-300");
      dot.style.transform = "translateX(0)";
      sequenceFields.classList.add("hidden");
    }
  });

  phoneInput.addEventListener("input", () => {
    phoneInput.value = formatPhoneBR(phoneInput.value);
  });

  templateSelect.addEventListener("change", () => {
    if (templateSelect.value === "__custom__") {
      messageInput.value = "";
      followup1.value = "";
      followup2.value = "";
    } else {
      const t = templates.find((t) => t.name === templateSelect.value);
      if (t) {
        messageInput.value = t.message;
        followup1.value = t.followups?.[0] || "";
        followup2.value = t.followups?.[1] || "";
      }
    }
  });

  submitBtn.addEventListener("click", () => {
    const phone = phoneInput.value;
    const name = nameInput.value.trim();
    const mainMessage = messageInput.value;

    if (!phone || !mainMessage) {
      alert("Preencha o telefone e a mensagem.");
      return;
    }

    // Validate phone number
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13) {
      alert("Número de telefone inválido. Use o formato (XX) 9XXXX-XXXX.");
      return;
    }

    // Check for corrupted characters (U+FFFD = replacement character)
    if (mainMessage.includes('\uFFFD')) {
      alert("Atenção: Sua mensagem contém caracteres corrompidos (�). Por favor, recrie o template com os emojis corretos.");
      return;
    }

    // Check if sequence is enabled
    const hasFollowups = sequenceEnabled && (followup1.value.trim() || followup2.value.trim());

    if (hasFollowups) {
      // Build messages array
      const messages = [mainMessage];
      if (followup1.value.trim()) messages.push(followup1.value.trim());
      if (followup2.value.trim()) messages.push(followup2.value.trim());

      // Use template interval or default to 20 seconds
      const selectedTpl = templates.find(t => t.name === templateSelect.value);
      const intervalSeconds = selectedTpl?.interval || 20;

      // Send first message immediately
      const resolved = resolveTemplate(mainMessage, name);
      chrome.tabs.create({ url: buildWhatsAppLink(phone, resolved) });

      // Schedule follow-ups
      chrome.runtime.sendMessage({
        type: "SCHEDULE_SEQUENCE",
        phone,
        name,
        messages,
        intervalSeconds: intervalSeconds
      }, (response) => {
        if (response?.success) {
          alert(`Mensagem enviada!\n\n${messages.length - 1} follow-up(s) agendado(s) com intervalo de ${intervalSeconds} segundo(s).`);
        }
      });
    } else {
      // Single message
      const resolved = resolveTemplate(mainMessage, name);
      chrome.tabs.create({ url: buildWhatsAppLink(phone, resolved) });
    }
  });

  createLink.addEventListener("click", (e) => {
    e.preventDefault();
    editingTemplate = null;
    openCreatorModal(false);
  });

  manageLink.addEventListener("click", (e) => {
    e.preventDefault();
    renderManagerList();
    openModal(managerOverlay);
  });

  modalClose.addEventListener("click", () => closeModalEl(modalOverlay));
  tplCancel.addEventListener("click", () => closeModalEl(modalOverlay));
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModalEl(modalOverlay);
  });

  managerClose.addEventListener("click", () => closeModalEl(managerOverlay));
  managerDone.addEventListener("click", () => {
    loadTemplates(() => {});
    closeModalEl(managerOverlay);
  });
  managerOverlay.addEventListener("click", (e) => {
    if (e.target === managerOverlay) {
      loadTemplates(() => {});
      closeModalEl(managerOverlay);
    }
  });

  tplSave.addEventListener("click", () => {
    const name = tplName.value.trim();
    const message = tplMsg.value.trim();
    if (!name || !message) return;

    // Build followups array from template fields
    const followups = [];
    if (tplFollowup1.value.trim()) followups.push(tplFollowup1.value.trim());
    if (tplFollowup2.value.trim()) followups.push(tplFollowup2.value.trim());
    const isDefault = document.getElementById("tplDefault").checked;
    const interval = parseInt(document.getElementById("tplInterval").value) || 20;

    const saveTemplate = () => {
      chrome.runtime.sendMessage({ type: "SAVE_TEMPLATE", template: { name, message, followups, isDefault, interval } }, () => {
        loadTemplates(() => {
          templateSelect.value = name;
          messageInput.value = message;
          followup1.value = followups[0] || "";
          followup2.value = followups[1] || "";
        });
        closeModalEl(modalOverlay);
      });
    };

    if (editingTemplate && editingTemplate.name !== name) {
      chrome.runtime.sendMessage({ type: "DELETE_TEMPLATE", name: editingTemplate.name }, saveTemplate);
    } else {
      saveTemplate();
    }
  });

  loadTemplates();
})();
