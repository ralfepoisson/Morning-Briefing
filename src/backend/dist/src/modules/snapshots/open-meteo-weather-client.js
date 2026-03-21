import { describeFetchFailure } from '../../shared/fetch-error.js';
const WEATHER_CODE_LABELS = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Rime fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Dense drizzle',
    56: 'Freezing drizzle',
    57: 'Heavy freezing drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    66: 'Freezing rain',
    67: 'Heavy freezing rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Rain showers',
    81: 'Heavy rain showers',
    82: 'Violent rain showers',
    85: 'Snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Heavy thunderstorm with hail'
};
export class OpenMeteoWeatherClient {
    async getSnapshot(input) {
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.searchParams.set('latitude', String(input.latitude));
        url.searchParams.set('longitude', String(input.longitude));
        url.searchParams.set('timezone', input.timezone || 'auto');
        url.searchParams.set('forecast_days', '1');
        url.searchParams.set('current', 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m');
        url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max');
        let response;
        try {
            response = await fetch(url);
        }
        catch (error) {
            throw new Error(describeFetchFailure('Weather provider request', url, error));
        }
        if (!response.ok) {
            throw new Error('Weather provider request failed.');
        }
        const payload = await response.json();
        if (!payload.current || !payload.daily || !payload.daily.temperature_2m_max || !payload.daily.temperature_2m_min) {
            throw new Error('Weather provider response was incomplete.');
        }
        const temperature = formatTemperature(payload.current.temperature_2m);
        const apparent = formatTemperature(payload.current.apparent_temperature);
        const dailyHigh = formatTemperature(payload.daily.temperature_2m_max[0]);
        const dailyLow = formatTemperature(payload.daily.temperature_2m_min[0]);
        const precipitationProbability = payload.daily.precipitation_probability_max && payload.daily.precipitation_probability_max.length
            ? `${Math.round(payload.daily.precipitation_probability_max[0])}%`
            : 'n/a';
        const uvIndex = payload.daily.uv_index_max && payload.daily.uv_index_max.length
            ? formatUvIndex(payload.daily.uv_index_max[0])
            : 'n/a';
        const windSpeed = `${Math.round(payload.current.wind_speed_10m)} km/h`;
        const condition = getWeatherCodeLabel(payload.current.weather_code);
        return {
            temperature: temperature,
            condition: condition,
            location: input.locationLabel,
            highLow: `H: ${dailyHigh}  L: ${dailyLow}`,
            summary: `Latest forecast from Open-Meteo for ${input.locationLabel}.`,
            details: [
                { label: 'Feels like', value: apparent },
                { label: 'Rain', value: precipitationProbability },
                { label: 'UV', value: uvIndex },
                { label: 'Wind', value: windSpeed }
            ]
        };
    }
}
function getWeatherCodeLabel(code) {
    return WEATHER_CODE_LABELS[code] || 'Weather unavailable';
}
function formatTemperature(value) {
    return `${Math.round(value)}°`;
}
function formatUvIndex(value) {
    if (value < 3) {
        return 'Low';
    }
    if (value < 6) {
        return 'Moderate';
    }
    if (value < 8) {
        return 'High';
    }
    if (value < 11) {
        return 'Very high';
    }
    return 'Extreme';
}
