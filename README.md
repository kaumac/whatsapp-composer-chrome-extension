# WhatsApp Phone Composer

Chrome extension that detects Brazilian phone numbers on web pages and lets you send WhatsApp messages with customizable templates.

## Features

- **Phone Number Detection**: Automatically detects Brazilian phone numbers in various formats:
  - `11999595995`
  - `11 999595995`
  - `(11) 999595995`
  - `(11) 99959-5995`
  - `+55 11 99959-5995`
  - And more

- **Clickable Badges**: Detected numbers become clickable WhatsApp-styled badges

- **Composer Popover**: Click a badge to open a message composer with:
  - Phone number input with Brazilian format masking
  - Name field for personalization
  - Business name and region fields with page value pickers
  - Pre-built message templates
  - Custom template creation
  - Template variables: `{name}`, `{Name}`, `{business_name}`, `{region}`, `{greeting}`, `{Greeting}`

- **Time-based Greetings**: Automatically uses "bom dia", "boa tarde", or "boa noite" based on browser time

- **Standalone Popup**: Click the extension icon to compose a message without a detected number

## Installation (Local Development)

### Method 1: Load Unpacked (Recommended for Testing)

1. Open Chrome and navigate to `chrome://extensions/`

2. Enable **Developer mode** (toggle in top-right corner)

3. Click **Load unpacked** button

4. Select the `chrome_wpp` folder (this project directory)

5. The extension icon will appear in your Chrome toolbar

### Method 2: Using Chrome CLI

```bash
# macOS
open -a "Google Chrome" --args --load-extension="/path/to/chrome_wpp"

# Windows
chrome.exe --load-extension="C:\path\to\chrome_wpp"

# Linux
google-chrome --load-extension="/path/to/chrome_wpp"
```

## Usage

1. **On any webpage**: The extension automatically detects Brazilian phone numbers and wraps them in green WhatsApp badges

2. **Click a badge**: Opens the composer popover with the phone number pre-filled

3. **Fill in details**:
   - Enter the contact's name (optional)
   - Select a template or choose "Personalizar" for custom message
   - Edit the message as needed

4. **Click "Enviar no WhatsApp"**: Opens WhatsApp Web with the formatted message

5. **Template Variables**:
   - `{name}` or `{Name}` → Replaced with the Name field value
   - `{business_name}` → Replaced with the Nome do negócio field value
   - `{region}` → Replaced with the Região field value
   - `{greeting}` → "bom dia" / "boa tarde" / "boa noite"
   - `{Greeting}` → "Bom dia" / "Boa tarde" / "Boa noite"

## Creating Custom Templates

1. Click the extension icon or a phone badge
2. Click "Criar template" next to the template dropdown
3. Enter a name and message (use template variables as needed)
4. Click "Salvar"

## Submitting to Chrome Web Store

### Prerequisites

1. **Chrome Developer Account**
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Pay the one-time $5 registration fee
   - Verify your account

2. **Prepare Assets**
   - **Icon**: 128x128 PNG (already included)
   - **Screenshots**: At least one 1280x800 or 640x400 screenshot
   - **Promotional images** (optional):
     - Small tile: 440x280
     - Large tile: 1400x560

### Packaging

1. Create a ZIP file of your extension folder:

```bash
# From the project root
zip -r whatsapp-phone-composer.zip . -x "*.DS_Store" "icons/generate-icons.js" "icons/generate-icons.html" "icons/icon.svg"
```

**Important**: Do NOT include the icon generation scripts in your ZIP.

### Submission Steps

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)

2. Click **"New Item"** (or "Add new item" button)

3. Upload your ZIP file

4. Fill in the required fields:
   - **Title**: WhatsApp Phone Composer
   - **Description**: Detects Brazilian phone numbers on web pages and lets you send WhatsApp messages with customizable templates.
   - **Category**: Productivity
   - **Language**: Portuguese (Brazil)

5. Add screenshots (at least one required)

6. Set visibility:
   - **Public** - Listed in the Chrome Web Store
   - **Unlisted** - Only accessible via direct link
   - **Private** - Only for specified users

7. Click **"Publish"**

### Review Process

- Chrome typically reviews extensions within 1-3 business days
- Common rejection reasons:
  - Missing privacy policy (if collecting data)
  - Unclear description of functionality
  - Deceptive installation practices

### Privacy Policy

Since this extension uses `chrome.storage` to save templates locally, you should include a simple privacy policy. Example:

```markdown
# Privacy Policy

WhatsApp Phone Composer stores message templates locally in your browser using Chrome's storage API. No data is sent to external servers. The extension only communicates with WhatsApp (wa.me) when you explicitly click the send button.
```

## File Structure

```
chrome_wpp/
├── manifest.json       # Extension configuration
├── content.js          # Content script (phone detection + badge injection)
├── content.css         # Base styles
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic
├── background.js       # Service worker for template storage
├── templates.json      # Default message templates
├── icons/
│   ├── icon16.png      # 16x16 icon
│   ├── icon48.png      # 48x48 icon
│   └── icon128.png     # 128x128 icon
└── README.md           # This file
```

## Permissions

- `storage`: Save custom templates locally
- `activeTab`: Open WhatsApp links from the popup

## Tech Stack

- Vanilla JavaScript (no frameworks)
- Tailwind CSS CDN (for content script styling)
- Chrome Extension Manifest V3
