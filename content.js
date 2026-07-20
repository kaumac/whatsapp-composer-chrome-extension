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
    { name: "Apresentação", message: "Olá {name}, {Greeting}! Meu nome é [seu nome] e gostaria de conversar com você." },
    { name: "Follow-up", message: "Oi {name}! {Greeting}, tudo bem? Gostaria de dar sequência na nossa conversa." },
    { name: "Lembrete", message: "{Greeting} {name}! Este é um lembrete sobre [assunto]." },
  ];

  function injectStyles() {
    if (document.getElementById("wpp-tailwind-css")) return;
    const link = document.createElement("link");
    link.id = "wpp-tailwind-css";
    link.rel = "stylesheet";
    link.href = "https://cdn.tailwindcss.com";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.id = "wpp-custom-styles";
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      .wpp-ext-root, .wpp-ext-root * { all: initial; }
      .wpp-ext-root { font-family: 'Inter', system-ui, sans-serif; font-size: 14px; color: #1f2937; line-height: 1.5; }
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
      .wpp-ext-root input, .wpp-ext-root textarea, .wpp-ext-root select, .wpp-ext-root button { all: unset; box-sizing: border-box; }
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
    const digits = phone.replace(/\D/g, "");
    const full = digits.startsWith("55") ? digits : "55" + digits;
    const encoded = encodeURIComponent(message);
    return `https://wa.me/${full}?text=${encoded}`;
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

  function createTemplateCreatorModal(onSave) {
    closeModal();
    const root = document.createElement("div");
    root.className = "wpp-ext-root";
    root.innerHTML = `
      <div style="position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);">
        <div style="background:#fff;border-radius:16px;width:380px;max-width:90vw;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);overflow:hidden;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #f3f4f6;">
            <h3 style="margin:0;font-size:16px;font-weight:700;color:#111827;">Criar Template</h3>
            <button class="wpp-modal-close-btn" style="background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;display:flex;align-items:center;justify-content:center;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div style="padding:20px 24px;">
            <label style="display:block;margin-bottom:6px;font-size:13px;font-weight:600;color:#374151;">Nome do Template</label>
            <input class="wpp-tpl-name" type="text" placeholder="Ex: Boas-vindas" style="width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none;transition:border-color 0.15s;" onfocus="this.style.borderColor='#22c55e'" onblur="this.style.borderColor='#e5e7eb'" />
            <label style="display:block;margin:16px 0 6px;font-size:13px;font-weight:600;color:#374151;">Mensagem</label>
            <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">Use <code style="background:#f3f4f6;padding:1px 4px;border-radius:4px;">{name}</code>, <code style="background:#f3f4f6;padding:1px 4px;border-radius:4px;">{Greeting}</code></p>
            <textarea class="wpp-tpl-msg" rows="4" placeholder="Olá {name}, {Greeting}!" style="width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none;resize:vertical;min-height:80px;font-family:inherit;transition:border-color 0.15s;" onfocus="this.style.borderColor='#22c55e'" onblur="this.style.borderColor='#e5e7eb'"></textarea>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;padding:16px 24px;border-top:1px solid #f3f4f6;">
            <button class="wpp-tpl-cancel" style="padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;background:#f3f4f6;color:#374151;border:none;transition:background 0.15s;" onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">Cancelar</button>
            <button class="wpp-tpl-save" style="padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;background:#22c55e;color:#fff;border:none;transition:background 0.15s;" onmouseover="this.style.background='#16a34a'" onmouseout="this.style.background='#22c55e'">Salvar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    activeModal = root;

    root.querySelector(".wpp-modal-close-btn").onclick = closeModal;
    root.querySelector(".wpp-tpl-cancel").onclick = closeModal;
    root.querySelector(".wpp-tpl-save").onclick = () => {
      const name = root.querySelector(".wpp-tpl-name").value.trim();
      const message = root.querySelector(".wpp-tpl-msg").value.trim();
      if (!name || !message) return;
      chrome.runtime.sendMessage({ type: "SAVE_TEMPLATE", template: { name, message } }, () => { onSave(); closeModal(); });
    };
    root.addEventListener("click", (e) => { if (e.target === root.firstElementChild) closeModal(); });
  }

  function showPopover(badge, phoneDigits) {
    closePopover();
    injectStyles();

    const root = document.createElement("div");
    root.className = "wpp-ext-root";

    loadTemplates((templates) => {
      const formatted = formatPhoneBR(phoneDigits);
      const firstTemplate = templates[0];

      root.innerHTML = `
        <div style="position:absolute;z-index:2147483647;background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);width:360px;overflow:hidden;" class="wpp-popover-panel">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:linear-gradient(135deg,#22c55e 0%,#16a34a 100%);color:#fff;">
            <div style="display:flex;align-items:center;gap:8px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              <span style="font-weight:700;font-size:15px;">WhatsApp Composer</span>
            </div>
            <button class="wpp-close-btn" style="background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;display:flex;align-items:center;justify-content:center;opacity:0.8;transition:opacity 0.15s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div style="padding:20px;">
            <div style="margin-bottom:16px;">
              <label style="display:block;margin-bottom:6px;font-size:13px;font-weight:600;color:#374151;">Telefone</label>
              <input class="wpp-phone-input" type="tel" value="${formatted}" style="width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none;transition:all 0.15s;box-sizing:border-box;" onfocus="this.style.borderColor='#22c55e';this.style.boxShadow='0 0 0 3px rgba(34,197,94,0.1)'" onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'" />
            </div>
            <div style="margin-bottom:16px;">
              <label style="display:block;margin-bottom:6px;font-size:13px;font-weight:600;color:#374151;">Nome</label>
              <input class="wpp-name-input" type="text" placeholder="Nome do contato" style="width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none;transition:all 0.15s;box-sizing:border-box;" onfocus="this.style.borderColor='#22c55e';this.style.boxShadow='0 0 0 3px rgba(34,197,94,0.1)'" onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'" />
            </div>
            <div style="margin-bottom:16px;">
              <label style="display:block;margin-bottom:6px;font-size:13px;font-weight:600;color:#374151;">Template</label>
              <div style="display:flex;gap:8px;align-items:center;">
                <select class="wpp-template-select" style="flex:1;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none;background:#fff;cursor:pointer;transition:all 0.15s;">
                  ${templates.map((t) => `<option value="${t.name}">${t.name}</option>`).join("")}
                  <option value="__custom__">Personalizar</option>
                </select>
                <a href="#" class="wpp-create-tpl-link" style="font-size:12px;color:#22c55e;text-decoration:none;white-space:nowrap;font-weight:600;cursor:pointer;transition:color 0.15s;" onmouseover="this.style.color='#16a34a'" onmouseout="this.style.color='#22c55e'">Criar template</a>
              </div>
            </div>
            <div style="margin-bottom:20px;">
              <label style="display:block;margin-bottom:6px;font-size:13px;font-weight:600;color:#374151;">Mensagem</label>
              <textarea class="wpp-message-input" rows="4" style="width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none;resize:vertical;min-height:80px;font-family:inherit;transition:all 0.15s;box-sizing:border-box;" onfocus="this.style.borderColor='#22c55e';this.style.boxShadow='0 0 0 3px rgba(34,197,94,0.1)'" onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'">${firstTemplate ? firstTemplate.message : ""}</textarea>
            </div>
            <button class="wpp-submit-btn" style="width:100%;padding:12px;background:linear-gradient(135deg,#22c55e 0%,#16a34a 100%);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.2s;box-shadow:0 4px 14px rgba(34,197,94,0.35);" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 20px rgba(34,197,94,0.4)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 14px rgba(34,197,94,0.35)'">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Enviar no WhatsApp
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(root);
      activePopover = root;

      const panel = root.querySelector(".wpp-popover-panel");
      const rect = badge.getBoundingClientRect();
      panel.style.top = `${rect.bottom + window.scrollY + 10}px`;
      panel.style.left = `${rect.left + window.scrollX}px`;

      requestAnimationFrame(() => {
        const popRect = panel.getBoundingClientRect();
        if (popRect.right > window.innerWidth - 16) {
          panel.style.left = `${window.innerWidth - popRect.width - 16 + window.scrollX}px`;
        }
        if (popRect.left < 16) {
          panel.style.left = `${16 + window.scrollX}px`;
        }
      });

      const phoneInput = root.querySelector(".wpp-phone-input");
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

      root.querySelector(".wpp-template-select").addEventListener("change", (e) => {
        const msgInput = root.querySelector(".wpp-message-input");
        if (e.target.value === "__custom__") {
          msgInput.value = "";
        } else {
          const t = templates.find((t) => t.name === e.target.value);
          if (t) msgInput.value = t.message;
        }
      });

      root.querySelector(".wpp-create-tpl-link").addEventListener("click", (e) => {
        e.preventDefault();
        createTemplateCreatorModal(() => {
          loadTemplates((newTemplates) => {
            templates.length = 0;
            templates.push(...newTemplates);
            const select = root.querySelector(".wpp-template-select");
            const current = select.value;
            select.innerHTML = templates.map((t) => `<option value="${t.name}">${t.name}</option>`).join("") + '<option value="__custom__">Personalizar</option>';
            if ([...templates, { name: "__custom__" }].some((t) => t.name === current)) select.value = current;
          });
        });
      });

      root.querySelector(".wpp-submit-btn").addEventListener("click", () => {
        const phone = phoneInput.value;
        const name = root.querySelector(".wpp-name-input").value.trim();
        const message = root.querySelector(".wpp-message-input").value;
        const resolved = resolveTemplate(message, name);
        const link = buildWhatsAppLink(phone, resolved);
        window.open(link, "_blank");
      });

      root.querySelector(".wpp-close-btn").onclick = closePopover;
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
})();
