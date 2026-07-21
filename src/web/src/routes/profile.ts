import type { RouteContext } from './admin.ts';

export interface ProfileForm {
  displayName: string;
  phoneticName: string | null;
  email: string;
  avatarDataUrl: string | null;
  timezone: string;
  preferredLanguage: string;
  briefingDelivery: { telegram: { enabled: boolean; chatId: string } };
}

export function createProfileController(context: RouteContext) {
  return {
    async load(): Promise<ProfileForm> {
      const response = record(await context.api('/users/me'));
      return toForm(record(response.user ?? response));
    },
    async save(form: ProfileForm): Promise<ProfileForm> {
      validate(form);
      try {
        const response = record(await context.api('/users/me', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toPayload(form))
        }));
        context.notify('Your profile and delivery settings were saved.', 'success');
        return toForm(record(response.user ?? response));
      } catch (error) {
        context.notify(message(error, 'Your profile could not be saved right now.'), 'error');
        throw error;
      }
    }
  };
}

export async function renderProfileRoute(context: RouteContext): Promise<void> {
  const controller = createProfileController(context);
  try {
    const form = await controller.load();
    draw(form);
  } catch (error) {
    if (status(error) === 401) context.navigate('#/signed-out');
    else context.notify(message(error, 'Your profile is currently unavailable.'), 'error');
  }

  function draw(form: ProfileForm): void {
    context.container.innerHTML = `<section class="profile-page"><header><span>Profile</span><h1>User profile</h1><p>Manage identity, preferred output language, avatar, and audio delivery.</p></header>
      <form data-profile-form><div class="profile-grid">
      ${input('Name', 'displayName', form.displayName, true)}${input('Phonetic name', 'phoneticName', form.phoneticName || '')}${input('Email', 'email', form.email, true, 'email')}
      <label>Timezone<select name="timezone">${timezones(form.timezone)}</select></label>
      <label>Preferred language<select name="preferredLanguage">${languages(form.preferredLanguage)}</select></label>
      <label>Profile picture<input name="avatar" type="file" accept="image/png,image/jpeg,image/gif,image/webp"></label>
      ${form.avatarDataUrl ? `<img data-avatar-preview src="${escapeAttribute(form.avatarDataUrl)}" alt="Profile preview"><button type="button" data-clear-avatar>Remove image</button>` : '<span data-avatar-preview>No profile image</span>'}
      <label><input name="telegramEnabled" type="checkbox"${form.briefingDelivery.telegram.enabled ? ' checked' : ''}> Send generated audio via Telegram</label>
      ${input('Telegram chat ID', 'telegramChatId', form.briefingDelivery.telegram.chatId)}
      </div><button type="submit">Save profile</button></form></section>`;
    let avatar = form.avatarDataUrl;
    context.container.querySelector<HTMLInputElement>('input[name="avatar"]')?.addEventListener('change', async function () {
      const file = this.files?.[0]; if (!file) return;
      try { avatar = await avatarFileToDataUrl(file); const preview = context.container.querySelector<HTMLImageElement>('[data-avatar-preview]'); if (preview) preview.src = avatar; }
      catch (error) { context.notify(message(error, 'The selected image could not be prepared.'), 'error'); }
    });
    context.container.querySelector('[data-clear-avatar]')?.addEventListener('click', () => { avatar = null; draw({ ...form, avatarDataUrl: null }); });
    context.container.querySelector<HTMLFormElement>('[data-profile-form]')?.addEventListener('submit', async function (event) {
      event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement);
      const next: ProfileForm = {
        displayName: text(data.get('displayName')), phoneticName: text(data.get('phoneticName')) || null,
        email: text(data.get('email')), avatarDataUrl: avatar, timezone: text(data.get('timezone')),
        preferredLanguage: text(data.get('preferredLanguage')),
        briefingDelivery: { telegram: { enabled: data.get('telegramEnabled') === 'on', chatId: text(data.get('telegramChatId')) } }
      };
      try { draw(await controller.save(next)); } catch { /* notification is emitted by the controller */ }
    });
  }
}

export function avatarFileToDataUrl(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) return Promise.reject(new Error('Choose a PNG, JPEG, GIF, or WebP image.'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('The avatar could not be read.'));
    reader.onerror = () => reject(new Error('The avatar could not be read.'));
    reader.readAsDataURL(file);
  });
}

function toForm(user: Record<string, unknown>): ProfileForm {
  const delivery = record(user.briefingDelivery); const telegram = record(delivery.telegram);
  return {
    displayName: text(user.displayName), phoneticName: text(user.phoneticName) || null, email: text(user.email),
    avatarDataUrl: text(user.avatarDataUrl) || null, timezone: text(user.timezone) || 'UTC', preferredLanguage: text(user.preferredLanguage) || 'en-GB',
    briefingDelivery: { telegram: { enabled: telegram.enabled === true, chatId: text(telegram.chatId) } }
  };
}
function toPayload(form: ProfileForm): unknown { return { ...form, phoneticName: form.phoneticName || null, avatarDataUrl: form.avatarDataUrl || null, briefingDelivery: { telegram: { enabled: form.briefingDelivery.telegram.enabled, chatId: form.briefingDelivery.telegram.chatId || null } } }; }
function validate(form: ProfileForm): void { if (!form.displayName || !form.email || !form.timezone || !form.preferredLanguage) throw new Error('Name, email, timezone, and preferred language are required.'); if (form.briefingDelivery.telegram.enabled && !form.briefingDelivery.telegram.chatId.trim()) throw new Error('Enter a Telegram chat ID before enabling Telegram delivery.'); }
function input(label: string, name: string, value: string, required = false, type = 'text'): string { return `<label>${label}<input name="${name}" type="${type}" value="${escapeAttribute(value)}"${required ? ' required' : ''}></label>`; }
function timezones(selected: string): string { const values = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC', 'Europe/Paris', 'Europe/London', 'America/New_York']; return values.map((value) => `<option${value === selected ? ' selected' : ''}>${escapeAttribute(value)}</option>`).join(''); }
function languages(selected: string): string { const values = [['en-GB', 'English (UK)'], ['en-US', 'English (US)'], ['fr-FR', 'French'], ['de-DE', 'German'], ['es-ES', 'Spanish'], ['it-IT', 'Italian'], ['nl-NL', 'Dutch'], ['pt-PT', 'Portuguese'], ['ja-JP', 'Japanese'], ['ko-KR', 'Korean'], ['zh-CN', 'Chinese (Simplified)'], ['ar-SA', 'Arabic']]; return values.map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`).join(''); }
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: FormDataEntryValue | unknown): string { return typeof value === 'string' || typeof value === 'number' ? String(value) : ''; }
function escapeAttribute(value: string): string { return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
function message(error: unknown, fallback: string): string { const value = record(error); const data = record(value.data); return text(data.message ?? value.message) || fallback; }
function status(error: unknown): number { return Number(record(error).status || 0); }
