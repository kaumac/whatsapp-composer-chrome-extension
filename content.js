(function () {
  "use strict";

  const PHONE_REGEX = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)(?:9\s?)?\d{4}[-.\s]?\d{4}/g;
  const SKIP_TAGS = new Set([
    "SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT",
    "IFRAME", "OBJECT", "EMBED", "SVG", "CANVAS",
  ]);
  const BADGE_CLASS = "wpp-badge";

  let activePopover = null;
  let activeModal = null;

  const DEFAULT_TEMPLATES = [
    { name: "Apresentação", message: "Olá {name}, {Greeting}! Meu nome é [seu nome] e gostaria de conversar com você.", followups: ["Tudo bem? Gostaria de apresentar nossos serviços.", "Caso tenha interesse, posso enviar mais informações!"], interval: 20 },
    { name: "Follow-up", message: "Oi {name}! {Greeting}, tudo bem? Gostaria de dar sequência na nossa conversa.", followups: [], interval: 20 },
    { name: "Lembrete", message: "{Greeting} {name}! Este é um lembrete sobre [assunto].", followups: [], interval: 20 },
  ];

  function injectStyles() {
    if (document.getElementById("wpp-content-styles")) return;
    const style = document.createElement("style");
    style.id = "wpp-content-styles";
    style.textContent = `
      .wpp-badge {
        display: inline-flex !important; align-items: center; gap: 3px;
        background: #d1fae5 !important; border: 1px solid #6ee7b7 !important;
        border-radius: 6px !important; padding: 2px 8px !important;
        cursor: pointer !important; font-size: inherit !important;
        line-height: 1.4 !important; vertical-align: baseline !important;
        transition: all 0.15s !important; white-space: nowrap !important;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important;
      }
      .wpp-badge:hover { background: #a7f3d0 !important; border-color: #34d399 !important; transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important; }
      .wpp-badge-icon { flex-shrink: 0; }
      .wpp-badge-text { color: #065f46 !important; font-weight: 600 !important; font-size: 13px !important; }
      .wpp-popover { position: fixed !important; z-index: 2147483647 !important; background: white; border: 1px solid #e5e7eb; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); width: 360px; max-height: calc(100vh - 32px); overflow-y: auto; font-family: 'Inter', system-ui, sans-serif; font-size: 14px; color: #1f2937; }
      .wpp-popover * { box-sizing: border-box; }
      .wpp-popover-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; }
      .wpp-popover-body { padding: 20px; }
      .wpp-field { margin-bottom: 16px; }
      .wpp-label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: #374151; }
      .wpp-input { width: 100%; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; font-family: inherit; outline: none; transition: all 0.15s; }
      .wpp-input:focus { border-color: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,0.1); }
      .wpp-textarea { resize: vertical; min-height: 80px; }
      .wpp-select { width: 100%; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; font-family: inherit; outline: none; background: white; cursor: pointer; }
      .wpp-select:focus { border-color: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,0.1); }
      .wpp-links { display: flex; gap: 12px; margin-top: 6px; }
      .wpp-link { font-size: 12px; text-decoration: none; font-weight: 600; cursor: pointer; transition: color 0.15s; }
      .wpp-link-green { color: #22c55e; }
      .wpp-link-green:hover { color: #16a34a; }
      .wpp-link-gray { color: #6b7280; font-weight: 500; }
      .wpp-link-gray:hover { color: #374151; }
      .wpp-submit { width: 100%; padding: 12px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; box-shadow: 0 4px 14px rgba(34,197,94,0.35); }
      .wpp-submit:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(34,197,94,0.4); }
      .wpp-close { background: none; border: none; cursor: pointer; padding: 4px; border-radius: 6px; display: flex; align-items: center; justify-content: center; opacity: 0.8; transition: opacity 0.15s; color: white; }
      .wpp-close:hover { opacity: 1; }
      .wpp-modal-overlay { position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); }
      .wpp-modal { background: white; border-radius: 16px; width: 380px; max-width: 90vw; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden; }
      .wpp-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid #f3f4f6; }
      .wpp-modal-title { margin: 0; font-size: 16px; font-weight: 700; color: #111827; }
      .wpp-modal-body { padding: 20px 24px; }
      .wpp-modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px; border-top: 1px solid #f3f4f6; }
      .wpp-btn { padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: background 0.15s; }
      .wpp-btn-gray { background: #f3f4f6; color: #374151; }
      .wpp-btn-gray:hover { background: #e5e7eb; }
      .wpp-btn-green { background: #22c55e; color: white; }
      .wpp-btn-green:hover { background: #16a34a; }
      .wpp-hint { margin: 0 0 8px; font-size: 12px; color: #6b7280; }
      .wpp-hint code { background: #f3f4f6; padding: 1px 4px; border-radius: 4px; font-size: 11px; }
      .wpp-manager { width: 420px; max-height: 80vh; display: flex; flex-direction: column; }
      .wpp-manager-list { padding: 16px 24px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 10px; }
      .wpp-tpl-item { display: flex; align-items: flex-start; justify-content: space-between; padding: 12px; border: 1px solid #f3f4f6; border-radius: 10px; background: #fafafa; }
      .wpp-tpl-info { flex: 1; min-width: 0; }
      .wpp-tpl-name { font-weight: 600; font-size: 13px; color: #111827; margin-bottom: 4px; }
      .wpp-tpl-msg { font-size: 12px; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .wpp-tpl-actions { display: flex; gap: 6px; margin-left: 12px; flex-shrink: 0; }
      .wpp-tpl-btn { padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; border: none; transition: background 0.15s; }
      .wpp-tpl-edit { background: #e5e7eb; color: #374151; }
      .wpp-tpl-edit:hover { background: #d1d5db; }
      .wpp-tpl-delete { background: #fee2e2; color: #dc2626; }
      .wpp-tpl-delete:hover { background: #fecaca; }
    `;
    document.head.appendChild(style);
  }

  function normalizePhone(raw) {
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length >= 12) {
      return digits.slice(2);
    }
    return digits;
  }

  function formatPhoneBR(digits) {
    const d = digits.replace(/\D/g, "");
    if (d.length === 11) {
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    }
    if (d.length === 10) {
      return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    }
    return d;
  }

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

    // Encode properly
    const encoded = encodeURIComponent(cleanMessage);

    // Use the direct send endpoint. The wa.me desktop redirect can decode
    // supplementary Unicode characters (emoji) as U+FFFD.
    return `https://api.whatsapp.com/send/?phone=${phoneClean}&text=${encoded}`;
  }

  function closePopover() {
    if (activePopover) { activePopover.remove(); activePopover = null; }
  }

  function closeModal() {
    if (activeModal) { activeModal.remove(); activeModal = null; }
  }

  function loadTemplates(callback) {
    chrome.runtime.sendMessage({ type: "GET_TEMPLATES" }, (response) => {
      const custom = (response && response.customTemplates) || [];
      callback([...DEFAULT_TEMPLATES, ...custom]);
    });
  }

  const CLOSE_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  const WA_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

  function createTemplateCreatorModal(onSave, editTemplate) {
    closeModal();
    const isEdit = !!editTemplate;
    const overlay = document.createElement("div");
    overlay.className = "wpp-modal-overlay";
    overlay.innerHTML = `
      <div class="wpp-modal">
        <div class="wpp-modal-header">
          <h3 class="wpp-modal-title">${isEdit ? "Editar Template" : "Criar Template"}</h3>
          <button class="wpp-close-btn" style="color:#9ca3af;">${CLOSE_SVG}</button>
        </div>
        <div class="wpp-modal-body" style="max-height:60vh;overflow-y:auto;">
          <label class="wpp-label">Nome do Template</label>
          <input class="wpp-input wpp-tpl-name" type="text" value="${isEdit ? editTemplate.name : ""}" placeholder="Ex: Boas-vindas" />
          <label class="wpp-label" style="margin-top:16px;">Mensagem Inicial</label>
          <p class="wpp-hint">Use <code>{name}</code>, <code>{Greeting}</code></p>
          <textarea class="wpp-input wpp-textarea wpp-tpl-msg" rows="3" placeholder="Olá {name}, {Greeting}!">${isEdit ? editTemplate.message : ""}</textarea>
          <div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
            <label style="display:block;margin-bottom:8px;font-size:12px;font-weight:600;color:#6b7280;">Follow-ups (opcional)</label>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <div>
                <label style="display:block;margin-bottom:4px;font-size:11px;color:#9ca3af;">Follow-up 1</label>
                <textarea class="wpp-input wpp-tpl-fu1" rows="2" placeholder="Segunda mensagem..." style="resize:none;min-height:auto;"></textarea>
              </div>
              <div>
                <label style="display:block;margin-bottom:4px;font-size:11px;color:#9ca3af;">Follow-up 2</label>
                <textarea class="wpp-input wpp-tpl-fu2" rows="2" placeholder="Terceira mensagem..." style="resize:none;min-height:auto;"></textarea>
              </div>
            </div>
          </div>
          <div style="margin-top:16px;display:flex;align-items:center;gap:8px;">
            <input type="checkbox" class="wpp-tpl-default" style="width:16px;height:16px;accent-color:#22c55e;" ${isEdit && editTemplate?.isDefault ? 'checked' : ''} />
            <label style="font-size:13px;color:#374151;cursor:pointer;">Definir como template padrão</label>
          </div>
          <div style="margin-top:12px;">
            <label style="display:block;margin-bottom:4px;font-size:12px;font-weight:500;color:#6b7280;">Intervalo entre follow-ups (segundos)</label>
            <input type="number" class="wpp-input wpp-tpl-interval" value="${isEdit && editTemplate?.interval ? editTemplate.interval : 20}" min="10" max="3600" />
          </div>
        </div>
        <div class="wpp-modal-footer">
          <button class="wpp-btn wpp-btn-gray wpp-tpl-cancel">Cancelar</button>
          <button class="wpp-btn wpp-btn-green wpp-tpl-save">Salvar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    activeModal = overlay;

    overlay.querySelector(".wpp-close-btn").onclick = closeModal;
    overlay.querySelector(".wpp-tpl-cancel").onclick = closeModal;
    overlay.querySelector(".wpp-tpl-save").onclick = () => {
      const name = overlay.querySelector(".wpp-tpl-name").value.trim();
      const message = overlay.querySelector(".wpp-tpl-msg").value.trim();
      if (!name || !message) return;
      const followups = [];
      const fu1 = overlay.querySelector(".wpp-tpl-fu1")?.value.trim();
      const fu2 = overlay.querySelector(".wpp-tpl-fu2")?.value.trim();
      if (fu1) followups.push(fu1);
      if (fu2) followups.push(fu2);
      const isDefault = overlay.querySelector(".wpp-tpl-default")?.checked || false;
      const interval = parseInt(overlay.querySelector(".wpp-tpl-interval")?.value) || 20;

      const doSave = () => {
        chrome.runtime.sendMessage({ type: "SAVE_TEMPLATE", template: { name, message, followups, isDefault, interval } }, () => { onSave(); closeModal(); });
      };

      if (isEdit && editTemplate.name !== name) {
        chrome.runtime.sendMessage({ type: "DELETE_TEMPLATE", name: editTemplate.name }, doSave);
      } else {
        doSave();
      }
    };
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  }

  function createTemplateManagerModal(onRefresh) {
    closeModal();
    loadTemplates((templates) => {
      const overlay = document.createElement("div");
      overlay.className = "wpp-modal-overlay";

      function renderList() {
        const listEl = overlay.querySelector(".wpp-manager-list");
        if (!listEl) return;
        if (templates.length === 0) {
          listEl.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:20px 0;font-size:13px;">Nenhum template criado.</p>';
          return;
        }
        listEl.innerHTML = templates.map((t, i) => `
          <div class="wpp-tpl-item">
            <div class="wpp-tpl-info">
              <div class="wpp-tpl-name">${t.name} ${t.isDefault ? '<span style="font-size:10px;background:#dcfce7;color:#16a34a;padding:2px 6px;border-radius:4px;font-weight:600;margin-left:6px;">Padrão</span>' : ''}</div>
              <div class="wpp-tpl-msg">${t.message}</div>
            </div>
            <div class="wpp-tpl-actions">
              <button class="wpp-tpl-btn wpp-tpl-edit" data-idx="${i}">Editar</button>
              <button class="wpp-tpl-btn wpp-tpl-delete" data-idx="${i}">Excluir</button>
            </div>
          </div>
        `).join("");

        listEl.querySelectorAll(".wpp-tpl-edit").forEach((btn) => {
          btn.addEventListener("click", () => {
            const idx = parseInt(btn.dataset.idx);
            const tpl = templates[idx];
            createTemplateCreatorModal(() => {
              createTemplateManagerModal(onRefresh);
            }, tpl);
          });
        });

        listEl.querySelectorAll(".wpp-tpl-delete").forEach((btn) => {
          btn.addEventListener("click", () => {
            const idx = parseInt(btn.dataset.idx);
            const tpl = templates[idx];
            if (confirm(`Excluir template "${tpl.name}"?`)) {
              chrome.runtime.sendMessage({ type: "DELETE_TEMPLATE", name: tpl.name }, () => {
                templates.splice(idx, 1);
                renderList();
              });
            }
          });
        });
      }

      overlay.innerHTML = `
        <div class="wpp-modal wpp-manager">
          <div class="wpp-modal-header">
            <h3 class="wpp-modal-title">Gerenciar Templates</h3>
            <button class="wpp-close-btn" style="color:#9ca3af;">${CLOSE_SVG}</button>
          </div>
          <div class="wpp-manager-list"></div>
          <div class="wpp-modal-footer">
            <button class="wpp-btn wpp-btn-gray wpp-close-manager">Fechar</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      activeModal = overlay;

      renderList();

      overlay.querySelector(".wpp-close-btn").onclick = () => { closeModal(); onRefresh(); };
      overlay.querySelector(".wpp-close-manager").onclick = () => { closeModal(); onRefresh(); };
      overlay.addEventListener("click", (e) => { if (e.target === overlay) { closeModal(); onRefresh(); } });
    });
  }

  function showPopover(badge, phoneDigits) {
    closePopover();

    const popover = document.createElement("div");
    popover.className = "wpp-popover";

    loadTemplates((templates) => {
      const formatted = formatPhoneBR(phoneDigits);
      const firstTemplate = templates.find(t => t.isDefault) || templates[0];

      popover.innerHTML = `
        <div class="wpp-popover-header">
          <div style="display:flex;align-items:center;gap:8px;">
            ${WA_SVG.replace('width="18" height="18"', 'width="20" height="20"')}
            <span style="font-weight:700;font-size:15px;">WhatsApp Composer</span>
          </div>
          <button class="wpp-close wpp-close-btn">${'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'}</button>
        </div>
        <div class="wpp-popover-body">
          <div class="wpp-field">
            <label class="wpp-label">Telefone</label>
            <input class="wpp-input wpp-phone-input" type="tel" value="${formatted}" />
          </div>
          <div class="wpp-field">
            <label class="wpp-label">Nome</label>
            <input class="wpp-input wpp-name-input" type="text" placeholder="Nome do contato" />
          </div>
          <div class="wpp-field">
            <label class="wpp-label">Template</label>
            <select class="wpp-select wpp-template-select">
              ${templates.map((t) => `<option value="${t.name}" ${t.isDefault ? 'selected' : ''}>${t.name}</option>`).join("")}
              <option value="__custom__">Personalizar</option>
            </select>
            <div class="wpp-links">
              <a href="#" class="wpp-link wpp-link-green wpp-create-tpl-link">Criar template</a>
              <a href="#" class="wpp-link wpp-link-gray wpp-manage-tpl-link">Gerenciar templates</a>
            </div>
          </div>
          <div class="wpp-field">
            <label class="wpp-label">Mensagem</label>
            <textarea class="wpp-input wpp-textarea wpp-message-input" rows="4">${firstTemplate ? firstTemplate.message : ""}</textarea>
          </div>
          <button class="wpp-submit wpp-submit-btn">
            ${WA_SVG}
            Enviar no WhatsApp
          </button>
        </div>
      `;

      // Mount directly under <html> so a transformed/styled <body> cannot
      // turn the fixed popover into a page-scrolling element.
      document.documentElement.appendChild(popover);
      activePopover = popover;

      const positionPopover = () => {
        if (!popover.isConnected) return;

        const rect = badge.getBoundingClientRect();
        const popRect = popover.getBoundingClientRect();
        const viewportPadding = 16;
        const gap = 10;
        const maxLeft = Math.max(viewportPadding, window.innerWidth - popRect.width - viewportPadding);
        const left = Math.min(Math.max(rect.left, viewportPadding), maxLeft);
        const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
        const top = spaceBelow >= popRect.height + gap
          ? rect.bottom + gap
          : Math.max(viewportPadding, rect.top - popRect.height - gap);

        popover.style.setProperty("top", `${Math.round(top)}px`, "important");
        popover.style.setProperty("left", `${Math.round(left)}px`, "important");
      };

      positionPopover();

      requestAnimationFrame(() => {
        positionPopover();
      });

      const phoneInput = popover.querySelector(".wpp-phone-input");
      phoneInput.addEventListener("input", (e) => {
        let v = e.target.value.replace(/\D/g, "");
        if (v.length > 11) v = v.slice(0, 11);
        if (v.length > 7) {
          e.target.value = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
        } else if (v.length > 2) {
          e.target.value = `(${v.slice(0, 2)}) ${v.slice(2)}`;
        } else {
          e.target.value = v;
        }
      });

      popover.querySelector(".wpp-template-select").addEventListener("change", (e) => {
        const msgInput = popover.querySelector(".wpp-message-input");
        if (e.target.value === "__custom__") {
          msgInput.value = "";
          popover._selectedFollowups = [];
          popover._selectedInterval = 20;
        } else {
          const t = templates.find((t) => t.name === e.target.value);
          if (t) {
            msgInput.value = t.message;
            popover._selectedFollowups = t.followups || [];
            popover._selectedInterval = t.interval || 20;
          }
        }
      });

      // Store initial template followups and interval
      popover._selectedFollowups = firstTemplate?.followups || [];
      popover._selectedInterval = firstTemplate?.interval || 20;

      popover.querySelector(".wpp-create-tpl-link").addEventListener("click", (e) => {
        e.preventDefault();
        createTemplateCreatorModal(() => {
          loadTemplates((newTemplates) => {
            templates.length = 0;
            templates.push(...newTemplates);
            const select = popover.querySelector(".wpp-template-select");
            const current = select.value;
            select.innerHTML = templates.map((t) => `<option value="${t.name}">${t.name}</option>`).join("") + '<option value="__custom__">Personalizar</option>';
            if ([...templates, { name: "__custom__" }].some((t) => t.name === current)) select.value = current;
          });
        });
      });

      popover.querySelector(".wpp-manage-tpl-link").addEventListener("click", (e) => {
        e.preventDefault();
        createTemplateManagerModal(() => {
          loadTemplates((newTemplates) => {
            templates.length = 0;
            templates.push(...newTemplates);
            const select = popover.querySelector(".wpp-template-select");
            const current = select.value;
            select.innerHTML = templates.map((t) => `<option value="${t.name}">${t.name}</option>`).join("") + '<option value="__custom__">Personalizar</option>';
            if ([...templates, { name: "__custom__" }].some((t) => t.name === current)) select.value = current;
            else select.value = templates[0]?.name || "__custom__";
          });
        });
      });

      popover.querySelector(".wpp-submit-btn").addEventListener("click", () => {
        const phone = phoneInput.value;
        const name = popover.querySelector(".wpp-name-input").value.trim();
        const message = popover.querySelector(".wpp-message-input").value;
        const followups = popover._selectedFollowups || [];

        // Validate phone
        const digits = phone.replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 13) {
          alert("Número de telefone inválido.");
          return;
        }

        // Check for corrupted characters
        if (message.includes('\uFFFD')) {
          alert("Atenção: Sua mensagem contém caracteres corrompidos (�). Por favor, recrie o template com os emojis corretos.");
          return;
        }

        // Send first message
        const resolved = resolveTemplate(message, name);
        const link = buildWhatsAppLink(phone, resolved);
        window.open(link, "_blank");

        // If there are follow-ups, schedule them via background
        if (followups.length > 0) {
          const messages = [message, ...followups];
          // Get interval from the selected template
          const selectedTpl = templates.find(t => t.name === popover.querySelector(".wpp-template-select")?.value);
          const intervalSeconds = selectedTpl?.interval || 20;
          chrome.runtime.sendMessage({
            type: "SCHEDULE_SEQUENCE",
            phone,
            name,
            messages,
            intervalSeconds: intervalSeconds
          });
        }

        closePopover();
      });

      popover.querySelector(".wpp-close-btn").onclick = closePopover;
    });

    document.addEventListener("click", function outsideClick(e) {
      if (activePopover && !activePopover.contains(e.target) && !badge.contains(e.target)) {
        closePopover();
        document.removeEventListener("click", outsideClick);
      }
    });

    document.addEventListener("keydown", function escKey(e) {
      if (e.key === "Escape") { closePopover(); document.removeEventListener("keydown", escKey); }
    });
  }

  function createBadge(phoneText) {
    const span = document.createElement("span");
    span.className = BADGE_CLASS;
    span.innerHTML = `
      <svg class="wpp-badge-icon" viewBox="0 0 24 24" width="14" height="14">
        <path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
      <span class="wpp-badge-text">${phoneText}</span>
    `;
    return span;
  }

  function processTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (SKIP_TAGS.has(node.parentElement?.tagName)) return NodeFilter.FILTER_REJECT;
        if (node.parentElement?.closest(`.${BADGE_CLASS}`)) return NodeFilter.FILTER_REJECT;
        if (node.parentElement?.getAttribute("contenteditable") === "true") return NodeFilter.FILTER_REJECT;
        PHONE_REGEX.lastIndex = 0;
        return PHONE_REGEX.test(node.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach((textNode) => {
      const text = textNode.textContent;
      PHONE_REGEX.lastIndex = 0;
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      let match;

      while ((match = PHONE_REGEX.exec(text)) !== null) {
        if (match.index > lastIndex) fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        const raw = match[0];
        const digits = normalizePhone(raw);
        if (digits.length >= 10 && digits.length <= 11) {
          const badge = createBadge(raw.trim());
          badge.addEventListener("click", (e) => { e.stopPropagation(); showPopover(badge, digits); });
          fragment.appendChild(badge);
        } else {
          fragment.appendChild(document.createTextNode(raw));
        }
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < text.length) fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      textNode.parentNode.replaceChild(fragment, textNode);
    });
  }

  injectStyles();
  processTextNodes(document.body);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && !node.classList?.contains(BADGE_CLASS)) {
          processTextNodes(node);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "OPEN_COMPOSER") {
      const tempBadge = document.createElement("span");
      tempBadge.className = BADGE_CLASS;
      tempBadge.style.cssText = "position:fixed;top:50%;left:50%;z-index:2147483647;";
      tempBadge.innerHTML = `
        <svg class="wpp-badge-icon" viewBox="0 0 24 24" width="14" height="14">
          <path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        <span class="wpp-badge-text">${message.text}</span>
      `;
      document.body.appendChild(tempBadge);
      showPopover(tempBadge, message.phone);
    }
  });
})();
