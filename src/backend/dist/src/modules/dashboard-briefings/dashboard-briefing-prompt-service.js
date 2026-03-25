import { stableStringify } from '../snapshots/snapshot-job-utils.js';
export const DASHBOARD_BRIEFING_PROMPT_VERSION = 'dashboard-briefing-v1';
export class DashboardBriefingPromptService {
    buildPrompt(input) {
        return {
            developer: 'You write spoken dashboard audio briefings. Return valid JSON only with this exact shape: ' +
                '{"title":"string","estimatedDurationSeconds":75,"sections":[{"name":"string","script":"string"}],"fullScript":"string"}. ' +
                'Use only the provided structured input. Do not invent facts, times, locations, or summaries. ' +
                'Skip empty sections, keep delivery natural and concise, avoid robotic repetition, and stay within the target duration.',
            user: stableStringify(input)
        };
    }
    parseModelOutput(content, fallbackInput) {
        const parsed = JSON.parse(extractJsonObject(content));
        const sections = Array.isArray(parsed.sections)
            ? parsed.sections
                .map(normalizeSection)
                .filter(function filterSection(section) {
                return !!section;
            })
            : [];
        const title = typeof parsed.title === 'string' && parsed.title.trim()
            ? parsed.title.trim()
            : `${fallbackInput.dashboardName} Audio Briefing`;
        const fullScript = typeof parsed.fullScript === 'string' && parsed.fullScript.trim()
            ? parsed.fullScript.trim()
            : sections.map(function joinSection(section) {
                return section.script;
            }).join(' ').trim();
        const estimatedDurationSeconds = normalizeDuration(parsed.estimatedDurationSeconds, fullScript, fallbackInput.targetDurationSeconds);
        if (!sections.length || !fullScript) {
            throw new Error('Dashboard briefing LLM returned an empty script.');
        }
        return {
            title,
            estimatedDurationSeconds,
            sections,
            fullScript
        };
    }
    buildFallbackScript(input) {
        const sections = input.sections.map(function mapSection(section) {
            return {
                name: toTitleCase(section.widgetType),
                script: buildFallbackSectionScript(section)
            };
        }).filter(function filterSection(section) {
            return !!section.script;
        });
        const fullScript = sections.map(function joinSection(section) {
            return section.script;
        }).join(' ').trim();
        return {
            title: `${input.dashboardName} Audio Briefing`,
            estimatedDurationSeconds: normalizeDuration(undefined, fullScript, input.targetDurationSeconds),
            sections,
            fullScript
        };
    }
}
function normalizeSection(section) {
    if (!section || typeof section !== 'object') {
        return null;
    }
    const candidate = section;
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    const script = typeof candidate.script === 'string' ? candidate.script.trim() : '';
    if (!name || !script) {
        return null;
    }
    return {
        name,
        script
    };
}
function extractJsonObject(content) {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
        throw new Error('Dashboard briefing LLM did not return valid JSON.');
    }
    return content.slice(start, end + 1);
}
function normalizeDuration(value, script, targetDurationSeconds) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return Math.round(value);
    }
    const estimatedFromWords = Math.round(Math.max(30, script.split(/\s+/).filter(Boolean).length / 2.4));
    return Math.min(Math.max(estimatedFromWords, 30), Math.max(30, targetDurationSeconds));
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
function toTitleCase(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}
