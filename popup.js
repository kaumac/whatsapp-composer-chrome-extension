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

  function resolveTemplate(template, name, businessName, region) {
    const g = getGreeting();
    const G = g.charAt(0).toUpperCase() + g.slice(1);
    return template
      .replace(/\{name\}/g, name || "")
      .replace(/\{Name\}/g, name || "")
      .replace(/\{business_name\}/g, businessName || "")
      .replace(/\{region\}/g, region || "")
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
  const businessNameInput = document.getElementById("businessName");
  const regionInput = document.getElementById("region");
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
  const templateFollowups = document.getElementById("templateFollowups");
  const addTemplateFollowup = document.getElementById("addTemplateFollowup");
  const managerOverlay = document.getElementById("managerOverlay");
  const managerClose = document.getElementById("managerClose");
  const managerDone = document.getElementById("managerDone");
  const templateList = document.getElementById("templateList");

  // Sequence elements
  const toggleSequence = document.getElementById("toggleSequence");
  const sequenceFields = document.getElementById("sequenceFields");
  const sequenceFollowups = document.getElementById("sequenceFollowups");
  const addSequenceFollowup = document.getElementById("addSequenceFollowup");
  const delayMinutes = document.getElementById("delayMinutes");

  let templates = [];
  let editingTemplate = null;
  let sequenceEnabled = false;

  function renumberFollowups(container) {
    container.querySelectorAll(".followup-field").forEach((field, index) => {
      field.querySelector(".followup-label").textContent = `Follow-up ${index + 1}`;
      field.querySelector("textarea").placeholder = index === 0 ? "Segunda mensagem..." : "Próxima mensagem...";
    });
  }

  function addFollowupField(container, value = "", focus = true) {
    const field = document.createElement("div");
    field.className = "followup-field";
    field.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <label class="followup-label text-[11px] text-gray-400"></label>
        <button type="button" class="remove-followup text-[11px] font-medium text-red-500 hover:text-red-600">Excluir</button>
      </div>
      <textarea rows="2" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none resize-none font-[inherit] transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/10"></textarea>
    `;
    field.querySelector("textarea").value = value;
    field.querySelector(".remove-followup").addEventListener("click", () => {
      field.remove();
      renumberFollowups(container);
    });
    container.appendChild(field);
    renumberFollowups(container);
    if (focus) field.querySelector("textarea").focus();
  }

  function setFollowupFields(container, followups = []) {
    container.innerHTML = "";
    followups
      .filter((followup) => String(followup || "").trim())
      .forEach((followup) => addFollowupField(container, followup, false));
  }

  function getFollowupValues(container) {
    return [...container.querySelectorAll("textarea")]
      .map((textarea) => textarea.value.trim())
      .filter(Boolean);
  }

  function getDefaultTemplate(isBusiness) {
    return templates.find((template) => isBusiness ? template.isBusinessDefault : template.isDefault)
      || templates.find((template) => template.isDefault)
      || templates[0];
  }

  function applyTemplate(template) {
    if (!template) return;
    templateSelect.value = template.name;
    messageInput.value = template.message;
    setFollowupFields(sequenceFollowups, template.followups || []);
  }

  function openModal(overlay) {
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
  }

  function closeModalEl(overlay) {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
  }

  function populateTemplates() {
    const defaultTpl = getDefaultTemplate(Boolean(businessNameInput.value.trim()));
    templateSelect.innerHTML = templates.map((t) => `<option value="${t.name}" ${t.name === defaultTpl?.name ? 'selected' : ''}>${t.name}</option>`).join("") + '<option value="__custom__">Personalizar</option>';
    applyTemplate(defaultTpl);
  }

  function loadTemplates(callback) {
    chrome.runtime.sendMessage({ type: "GET_TEMPLATES" }, (response) => {
      const custom = (response && response.customTemplates) || [];
      const deleted = new Set((response && response.deletedTemplates) || []);
      const customNames = new Set(custom.map((template) => template.name));
      const defaults = DEFAULT_TEMPLATES.filter(
        (template) => !deleted.has(template.name) && !customNames.has(template.name)
      );
      templates = [...defaults, ...custom];
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
          <div class="font-semibold text-[13px] text-gray-900 mb-1">${t.name} ${t.isDefault ? '<span class="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded font-semibold ml-1">Padrão para indivíduos</span>' : ''} ${t.isBusinessDefault ? '<span class="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-semibold ml-1">Padrão para negócios</span>' : ''}</div>
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
    setFollowupFields(templateFollowups, isEdit ? editingTemplate?.followups || [] : []);
    document.getElementById("tplDefault").checked = isEdit && editingTemplate?.isDefault || false;
    document.getElementById("tplBusinessDefault").checked = isEdit && editingTemplate?.isBusinessDefault || false;
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

  addTemplateFollowup.addEventListener("click", () => addFollowupField(templateFollowups));
  addSequenceFollowup.addEventListener("click", () => addFollowupField(sequenceFollowups));

  phoneInput.addEventListener("input", () => {
    phoneInput.value = formatPhoneBR(phoneInput.value);
  });

  businessNameInput.addEventListener("input", () => {
    applyTemplate(getDefaultTemplate(Boolean(businessNameInput.value.trim())));
  });

  templateSelect.addEventListener("change", () => {
    if (templateSelect.value === "__custom__") {
      messageInput.value = "";
      setFollowupFields(sequenceFollowups);
    } else {
      const t = templates.find((t) => t.name === templateSelect.value);
      if (t) {
        applyTemplate(t);
      }
    }
  });

  submitBtn.addEventListener("click", () => {
    const phone = phoneInput.value;
    const name = nameInput.value.trim();
    const businessName = businessNameInput.value.trim();
    const region = regionInput.value.trim();
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
    const followups = sequenceEnabled ? getFollowupValues(sequenceFollowups) : [];
    const hasFollowups = followups.length > 0;

    if (hasFollowups) {
      // Build messages array
      const messages = [mainMessage, ...followups];

      // Use template interval or default to 20 seconds
      const selectedTpl = templates.find(t => t.name === templateSelect.value);
      const intervalSeconds = selectedTpl?.interval || 20;

      // Send first message immediately
      const resolved = resolveTemplate(mainMessage, name, businessName, region);
      chrome.tabs.create({ url: buildWhatsAppLink(phone, resolved) });

      // Schedule follow-ups
      chrome.runtime.sendMessage({
        type: "SCHEDULE_SEQUENCE",
        phone,
        name,
        businessName,
        region,
        messages,
        intervalSeconds: intervalSeconds
      }, (response) => {
        if (response?.success) {
          alert(`Mensagem enviada!\n\n${messages.length - 1} follow-up(s) agendado(s) com intervalo de ${intervalSeconds} segundo(s).`);
        }
      });
    } else {
      // Single message
      const resolved = resolveTemplate(mainMessage, name, businessName, region);
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

    const followups = getFollowupValues(templateFollowups);
    const isDefault = document.getElementById("tplDefault").checked;
    const isBusinessDefault = document.getElementById("tplBusinessDefault").checked;
    const interval = parseInt(document.getElementById("tplInterval").value) || 20;

    const saveTemplate = () => {
      chrome.runtime.sendMessage({ type: "SAVE_TEMPLATE", template: { name, message, followups, isDefault, isBusinessDefault, interval } }, () => {
        loadTemplates(() => {
          applyTemplate(templates.find((template) => template.name === name));
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
