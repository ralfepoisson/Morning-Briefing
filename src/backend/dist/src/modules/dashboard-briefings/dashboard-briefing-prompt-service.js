import { stableStringify } from '../snapshots/snapshot-job-utils.js';
export const DASHBOARD_BRIEFING_PROMPT_VERSION = 'dashboard-briefing-v1';
export class DashboardBriefingPromptService {
    buildPrompt(input) {
        return {
            developer: 'You write spoken dashboard audio briefings. Return only the final spoken script as plain text. ' +
                'Use only the provided structured input. Do not invent facts, times, locations, or summaries. ' +
                'Skip empty sections, keep delivery natural and concise, avoid robotic repetition, and stay within the target duration. ' +
                `Ensure the final output is in ${input.preferredLanguage}. ` +
                'Do not wrap the response in JSON, markdown, labels, or commentary.',
            user: stableStringify(input)
        };
    }
    parseModelOutput(content, fallbackInput) {
        const fullScript = normalizeScriptText(content);
        const estimatedDurationSeconds = normalizeDuration(fullScript, fallbackInput.targetDurationSeconds);
        return {
            title: `${fallbackInput.dashboardName} Audio Briefing`,
            estimatedDurationSeconds,
            fullScript
        };
    }
    buildFallbackScript(input) {
        const fullScript = [
            buildGreeting(input.listener),
            ...input.sections.map(function mapSection(section) {
                return buildFallbackSectionScript(section);
            })
        ].filter(Boolean).join(' ').trim();
        return {
            title: `${input.dashboardName} Audio Briefing`,
            estimatedDurationSeconds: normalizeDuration(fullScript, input.targetDurationSeconds),
            fullScript
        };
    }
}
function normalizeDuration(script, targetDurationSeconds) {
    const estimatedFromWords = Math.round(Math.max(30, script.split(/\s+/).filter(Boolean).length / 2.4));
    return Math.min(Math.max(estimatedFromWords, 30), Math.max(30, targetDurationSeconds));
}
function normalizeScriptText(content) {
    const script = content.trim();
    if (!script) {
        throw new Error('Dashboard briefing LLM returned an empty script.');
    }
    return script;
}
function buildGreeting(listener) {
    const name = readStringOrNull(listener.greetingName);
    if (name) {
        return `Hi there ${name}.`;
    }
    return 'Hi there.';
}
function buildFallbackSectionScript(section) {
    if (section.widgetType === 'weather') {
        return [
            `Weather: ${readString(section.content.location, 'your location')}.`,
            `${readString(section.content.summary, readString(section.content.condition, 'Conditions are available in the dashboard.'))}`
        ].join(' ').trim();
    }
    if (section.widgetType === 'calendar') {
        const items = Array.isArray(section.content.events) ? section.content.events : [];
        if (!items.length) {
            return 'Calendar: you have no events highlighted for today.';
        }
        return `Calendar: ${items.slice(0, 3).map(function mapItem(item) {
            const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : 'Untitled event';
            const startTime = typeof item.startTime === 'string' && item.startTime.trim() ? item.startTime.trim() : '';
            return startTime ? `${title} at ${startTime}` : title;
        }).join(', ')}.`;
    }
    if (section.widgetType === 'tasks') {
        const dueToday = Array.isArray(section.content.dueToday) ? section.content.dueToday : [];
        if (!dueToday.length) {
            return 'Tasks: there are no due-today items highlighted right now.';
        }
        return `Tasks: focus on ${dueToday.slice(0, 3).map(function mapItem(item) {
            return typeof item.title === 'string' && item.title.trim() ? item.title.trim() : 'an untitled task';
        }).join(', ')}.`;
    }
    if (section.widgetType === 'email') {
        const recentMessages = Array.isArray(section.content.recentMessages)
            ? section.content.recentMessages
            : [];
        const unreadCount = typeof section.content.unreadCount === 'number' ? section.content.unreadCount : 0;
        if (!recentMessages.length) {
            return 'Email: there are no recent messages highlighted right now.';
        }
        return `Email: ${unreadCount} unread, including ${recentMessages.slice(0, 3).map(function mapItem(item) {
            const subject = typeof item.subject === 'string' && item.subject.trim() ? item.subject.trim() : 'No subject';
            const from = typeof item.from === 'string' && item.from.trim() ? item.from.trim() : 'unknown sender';
            return `${subject} from ${from}`;
        }).join(', ')}.`;
    }
    if (section.widgetType === 'news') {
        const headlines = Array.isArray(section.content.headlines) ? section.content.headlines : [];
        if (!headlines.length) {
            return '';
        }
        return `News: ${headlines.slice(0, 3).map(function mapHeadline(item) {
            return typeof item.headline === 'string' && item.headline.trim() ? item.headline.trim() : '';
        }).filter(Boolean).join('. ')}.`;
    }
    return `${toTitleCase(section.widgetType)}: ${readString(section.content.summary, section.title)}.`;
}
function readString(value, fallback) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
function readStringOrNull(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
