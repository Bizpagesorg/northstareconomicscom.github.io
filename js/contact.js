const CONTACT_ENDPOINT = 'https://bizpages.org/php/phpmailer_sender_remote_allnews.php';
export function contactEndpoint() { return CONTACT_ENDPOINT; }
export function encodeRemoteMessage(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary)
    .replaceAll('+', '_myplus_')
    .replaceAll('/', '_myslash_');
}

export function buildRemoteContactUrl(message, timestamp = Date.now()) {
  const url = new URL(contactEndpoint());
  url.searchParams.set('p', encodeRemoteMessage(message));
  url.searchParams.set('h', `northstar-${timestamp}`);
  return url.toString();
}

export function contactMessage(form) {
  const data = new FormData(form);
  const language = form.dataset.language === 'ru' ? 'ru' : 'en';
  return [
    'Northstar Economics contact request',
    `Language: ${language}`,
    `Page: ${globalThis.location?.href ?? 'unknown'}`,
    `Name: ${String(data.get('name') ?? '').trim()}`,
    `Email: ${String(data.get('email') ?? '').trim()}`,
    `Subject: ${String(data.get('subject') ?? '').trim()}`,
    '',
    String(data.get('message') ?? '').trim()
  ].join('\n');
}

export async function handleContactSubmit(event, fetchImpl = globalThis.fetch) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector('[data-contact-status]');
  const button = form.querySelector('button[type="submit"]');
  if (button?.disabled || !form.reportValidity()) return false;
  const originalLabel = button?.textContent ?? '';
  if (button) {
    button.disabled = true;
    button.textContent = form.dataset.sending;
  }
  if (status) {
    status.textContent = form.dataset.sending;
    status.dataset.state = 'sending';
  }

  try {
    const permission = await fetchImpl(contactEndpoint(), {method: 'OPTIONS', mode: 'cors', credentials: 'omit', signal: AbortSignal.timeout(15000)});
    if (!permission.ok) throw new Error('Mail service unavailable');
    const response = await fetchImpl(buildRemoteContactUrl(contactMessage(form)), {
      method: 'GET',
      signal: AbortSignal.timeout(30000),
      mode: 'cors',
      credentials: 'omit',
      headers: { Accept: 'text/plain' }
    });
    const reply = await response.text();
    if (!response.ok || !reply.includes('Mailer Success!')) {
      throw new Error('Remote mail service rejected the request');
    }
    form.reset();
    if (status) {
      status.textContent = form.dataset.success;
      status.dataset.state = 'success';
    }
    return true;
  } catch (error) {
    if (status) {
      status.textContent = form.dataset.error;
      status.dataset.state = 'error';
    }
    return false;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }
}


for (const form of document.querySelectorAll('[data-contact-form]')) {
  form.addEventListener('submit', handleContactSubmit);
}
