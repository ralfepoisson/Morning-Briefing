import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { logApplicationEvent, toLogErrorContext } from '../admin/application-logger.js';
export class CompositeDashboardBriefingDeliveryService {
    channels;
    constructor(channels) {
        this.channels = channels;
    }
    async deliverGeneratedAudio(input) {
        for (const channel of this.channels) {
            await channel.deliverGeneratedAudio(input);
        }
    }
}
export class TelegramDashboardBriefingDeliveryChannel {
    prisma;
    config;
    fetchImpl;
    constructor(prisma, config = {}, fetchImpl = fetch) {
        this.prisma = prisma;
        this.config = config;
        this.fetchImpl = fetchImpl;
    }
    async deliverGeneratedAudio(input) {
        const profile = await this.prisma.appUser.findUnique({
            where: {
                id: input.user.userId
            },
            select: {
                displayName: true,
                telegramChatId: true,
                telegramDeliveryEnabled: true
            }
        });
        const botToken = normalizeOptionalString(this.config.botToken);
        const normalizedChatId = normalizeOptionalString(profile && profile.telegramChatId);
        const deliveryContext = {
            ownerUserId: input.user.userId,
            briefingId: input.briefing.id,
            channel: 'telegram',
            jobId: input.deliveryContext && typeof input.deliveryContext.jobId === 'string'
                ? input.deliveryContext.jobId
                : null
        };
        if (!input.audio) {
            logApplicationEvent({
                level: 'info',
                scope: 'dashboard-briefing',
                event: 'dashboard_briefing_delivery_skipped',
                message: 'Telegram delivery skipped because no generated audio is available.',
                context: {
                    ...deliveryContext,
                    reason: 'audio_missing'
                }
            });
            return false;
        }
        if (!profile) {
            logApplicationEvent({
                level: 'warn',
                scope: 'dashboard-briefing',
                event: 'dashboard_briefing_delivery_skipped',
                message: 'Telegram delivery skipped because the user profile could not be loaded.',
                context: {
                    ...deliveryContext,
                    reason: 'profile_missing'
                }
            });
            return false;
        }
        if (!profile.telegramDeliveryEnabled) {
            logApplicationEvent({
                level: 'info',
                scope: 'dashboard-briefing',
                event: 'dashboard_briefing_delivery_skipped',
                message: 'Telegram delivery skipped because Telegram delivery is disabled for the user.',
                context: {
                    ...deliveryContext,
                    reason: 'channel_disabled'
                }
            });
            return false;
        }
        if (!normalizedChatId) {
            logApplicationEvent({
                level: 'warn',
                scope: 'dashboard-briefing',
                event: 'dashboard_briefing_delivery_skipped',
                message: 'Telegram delivery skipped because no Telegram chat ID is configured for the user.',
                context: {
                    ...deliveryContext,
                    reason: 'chat_id_missing'
                }
            });
            return false;
        }
        if (!botToken) {
            logApplicationEvent({
                level: 'warn',
                scope: 'dashboard-briefing',
                event: 'dashboard_briefing_delivery_skipped',
                message: 'Telegram delivery is enabled for the user, but no Telegram bot token is configured.',
                context: {
                    ...deliveryContext,
                    reason: 'bot_token_missing'
                }
            });
            return false;
        }
        try {
            const audioBuffer = await readFile(input.storagePath);
            const formData = new FormData();
            logApplicationEvent({
                level: 'info',
                scope: 'dashboard-briefing',
                event: 'dashboard_briefing_delivery_attempt_started',
                message: 'Starting Telegram delivery for dashboard briefing audio.',
                context: {
                    ...deliveryContext,
                    chatIdSuffix: normalizedChatId.slice(-4),
                    storagePath: input.storagePath,
                    mimeType: input.audio.mimeType,
                    fileSizeBytes: audioBuffer.byteLength
                }
            });
            formData.set('chat_id', normalizedChatId);
            formData.set('caption', buildTelegramCaption(profile.displayName, input.briefing));
            formData.set('title', input.briefing.scriptJson && typeof input.briefing.scriptJson.title === 'string'
                ? input.briefing.scriptJson.title
                : 'Morning Briefing');
            formData.set('audio', new Blob([audioBuffer], { type: input.audio.mimeType }), path.basename(input.storagePath));
            const response = await this.fetchImpl(buildTelegramApiUrl(this.config.apiBaseUrl, botToken, 'sendAudio'), {
                method: 'POST',
                body: formData
            });
            if (!response.ok) {
                const responseText = await response.text();
                throw new Error(`Telegram delivery failed with status ${response.status}: ${truncateText(responseText, 500)}.`);
            }
            logApplicationEvent({
                level: 'info',
                scope: 'dashboard-briefing',
                event: 'dashboard_briefing_delivery_sent',
                message: 'Dashboard briefing audio sent to Telegram.',
                context: {
                    ...deliveryContext,
                    chatIdSuffix: normalizedChatId.slice(-4)
                }
            });
            return true;
        }
        catch (error) {
            logApplicationEvent({
                level: 'error',
                scope: 'dashboard-briefing',
                event: 'dashboard_briefing_delivery_channel_failed',
                message: error instanceof Error ? error.message : 'Telegram delivery failed.',
                context: {
                    ...deliveryContext,
                    chatIdSuffix: normalizedChatId.slice(-4),
                    ...toLogErrorContext(error)
                }
            });
            throw error;
        }
    }
}
function buildTelegramApiUrl(apiBaseUrl, botToken, method) {
    const normalizedBaseUrl = normalizeOptionalString(apiBaseUrl) || 'https://api.telegram.org';
    return normalizedBaseUrl.replace(/\/$/, '') + '/bot' + botToken + '/' + method;
}
function buildTelegramCaption(displayName, briefing) {
    const firstName = normalizeOptionalString(displayName) || 'there';
    const generatedAt = briefing.generatedAt ? new Date(briefing.generatedAt).toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC'
    }) + ' UTC' : 'just now';
    return `Morning Briefing for ${firstName}. Generated ${generatedAt}.`;
}
function normalizeOptionalString(value) {
    if (typeof value !== 'string' || !value.trim()) {
        return null;
    }
    return value.trim();
}
function truncateText(value, maxLength) {
    if (value.length <= maxLength) {
        return value;
    }
    return value.slice(0, maxLength - 1) + '…';
}
