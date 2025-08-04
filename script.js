// Open-Meteo API Configuration (No API key needed)
const GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';

// DOM Elements
const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const locationBtn = document.getElementById('location-btn');
const celsiusBtn = document.getElementById('celsius-btn');
const fahrenheitBtn = document.getElementById('fahrenheit-btn');
const currentTemp = document.getElementById('current-temp');
const weatherIcon = document.getElementById('weather-icon');
const weatherDescription = document.getElementById('weather-description');
const humidity = document.getElementById('humidity');
const wind = document.getElementById('wind');
const feelsLike = document.getElementById('feels-like');
const localTime = document.getElementById('local-time');
const localDate = document.getElementById('local-date');
const sunrise = document.getElementById('sunrise');
const sunset = document.getElementById('sunset');
const pressure = document.getElementById('pressure');
const lastUpdated = document.getElementById('last-updated');
const loadingOverlay = document.querySelector('.loading-overlay');
const errorModal = document.querySelector('.error-modal');
const errorMessage = document.getElementById('error-message');
const closeErrorBtn = document.getElementById('close-error-btn');
const backgroundAnimation = document.querySelector('.background-animation');
const weatherSound = document.getElementById('weather-sound');
const searchSuggestions = document.getElementById('search-suggestions');

// Global Variables
let currentUnit = 'c';
let currentWeatherData = null;
let suggestionTimeout = null;

// Weather Code to Description Mapping
const WEATHER_CODES = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow fall',
    73: 'Moderate snow fall',
    75: 'Heavy snow fall',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail'
};

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Set up event listeners
    searchBtn.addEventListener('click', searchWeather);
    locationBtn.addEventListener('click', getLocationWeather);
    cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchWeather();
    });
    closeErrorBtn.addEventListener('click', () => {
        errorModal.classList.remove('active');
    });
    celsiusBtn.addEventListener('click', () => toggleUnit('c'));
    fahrenheitBtn.addEventListener('click', () => toggleUnit('f'));
    
    // Search suggestions event listeners
    cityInput.addEventListener('input', handleSearchInput);
    cityInput.addEventListener('focus', () => {
        if (cityInput.value.trim() && searchSuggestions.children.length) {
            searchSuggestions.classList.add('active');
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            searchSuggestions.classList.remove('active');
        }
    });

    // Try to get user's location weather on page load
    getLocationWeather();
});

// Fetch weather data by city name
async function searchWeather() {
    const city = cityInput.value.trim();
    if (!city) return;

    showLoading();
    try {
        // First get coordinates from city name
        const geoResponse = await fetch(`${GEOCODING_API}?name=${city}&count=1`);
        const geoData = await geoResponse.json();
        
        if (!geoData.results || geoData.results.length === 0) {
            throw new Error('City not found');
        }

        const { latitude, longitude, name, country, admin1 } = geoData.results[0];
        
        // Then get weather data
        const weatherResponse = await fetch(
            `${WEATHER_API}?latitude=${latitude}&longitude=${longitude}&` +
            `current_weather=true&hourly=relativehumidity_2m,windspeed_10m&` +
            `daily=sunrise,sunset&timezone=auto`
        );
        const weatherData = await weatherResponse.json();
        
        // Format data to match our UI expectations
        currentWeatherData = {
            location: {
                name: `${name}, ${admin1 || country}`,
                localtime: weatherData.current_weather.time
            },
            current: {
                temp_c: weatherData.current_weather.temperature,
                temp_f: (weatherData.current_weather.temperature * 9/5) + 32,
                condition: {
                    text: WEATHER_CODES[weatherData.current_weather.weathercode] || 'Unknown',
                    code: weatherData.current_weather.weathercode
                },
                humidity: weatherData.hourly.relativehumidity_2m[0],
                wind_kph: weatherData.current_weather.windspeed,
                feelslike_c: weatherData.current_weather.temperature,
                feelslike_f: (weatherData.current_weather.temperature * 9/5) + 32,
                pressure_mb: 1010
            },
            forecast: {
                forecastday: [{
                    astro: {
                        sunrise: weatherData.daily.sunrise[0],
                        sunset: weatherData.daily.sunset[0]
                    }
                }]
            }
        };

        updateUI(currentWeatherData);
        updateBackground(
            WEATHER_CODES[weatherData.current_weather.weathercode], 
            weatherData.current_weather.time
        );
        playWeatherSound(WEATHER_CODES[weatherData.current_weather.weathercode]);
    } catch (error) {
        showError(error.message || 'Failed to fetch weather data');
    } finally {
        hideLoading();
    }
}

// Handle search input for suggestions
function handleSearchInput() {
    clearTimeout(suggestionTimeout);
    const query = cityInput.value.trim();
    
    if (!query || query.length < 2) {
        searchSuggestions.classList.remove('active');
        return;
    }
    
    suggestionTimeout = setTimeout(async () => {
        try {
            const cities = await fetchCitySuggestions(query);
            displaySuggestions(cities);
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        }
    }, 300);
}

// Fetch city suggestions
async function fetchCitySuggestions(query) {
    try {
        const response = await fetch(`${GEOCODING_API}?name=${query}&count=5`);
        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        return [];
    }
}

// Display suggestions in the dropdown
function displaySuggestions(cities) {
    searchSuggestions.innerHTML = '';
    
    if (!cities.length) {
        searchSuggestions.classList.remove('active');
        return;
    }

    cities.forEach(city => {
        const suggestionItem = document.createElement('div');
        suggestionItem.className = 'suggestion-item';
        
        const region = city.admin1 ? `, ${city.admin1}` : '';
        suggestionItem.textContent = `${city.name}${region}, ${city.country}`;
        
        suggestionItem.addEventListener('click', () => {
            cityInput.value = city.name;
            searchSuggestions.classList.remove('active');
            searchWeather();
        });
        
        searchSuggestions.appendChild(suggestionItem);
    });

    searchSuggestions.classList.add('active');
}

// Fetch weather data by user's location
async function getLocationWeather() {
    if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser');
        return;
    }

    showLoading();
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            try {
                const { latitude, longitude } = position.coords;
                
                // Get weather data
                const weatherResponse = await fetch(
                    `${WEATHER_API}?latitude=${latitude}&longitude=${longitude}&` +
                    `current_weather=true&hourly=relativehumidity_2m,windspeed_10m&` +
                    `daily=sunrise,sunset&timezone=auto`
                );
                const weatherData = await weatherResponse.json();
                
                // Get city name from reverse geocoding
                const geoResponse = await fetch(`${GEOCODING_API}?latitude=${latitude}&longitude=${longitude}&count=1`);
                const geoData = await geoResponse.json();
                
                const locationName = geoData.results ? 
                    `${geoData.results[0].name}, ${geoData.results[0].admin1 || geoData.results[0].country}` : 
                    'Your Location';

                // Format data to match our UI expectations
                currentWeatherData = {
                    location: {
                        name: locationName,
                        localtime: weatherData.current_weather.time
                    },
                    current: {
                        temp_c: weatherData.current_weather.temperature,
                        temp_f: (weatherData.current_weather.temperature * 9/5) + 32,
                        condition: {
                            text: WEATHER_CODES[weatherData.current_weather.weathercode] || 'Unknown',
                            code: weatherData.current_weather.weathercode
                        },
                        humidity: weatherData.hourly.relativehumidity_2m[0],
                        wind_kph: weatherData.current_weather.windspeed,
                        feelslike_c: weatherData.current_weather.temperature,
                        feelslike_f: (weatherData.current_weather.temperature * 9/5) + 32,
                        pressure_mb: 1010
                    },
                    forecast: {
                        forecastday: [{
                            astro: {
                                sunrise: weatherData.daily.sunrise[0],
                                sunset: weatherData.daily.sunset[0]
                            }
                        }]
                    }
                };

                cityInput.value = geoData.results ? geoData.results[0].name : '';
                updateUI(currentWeatherData);
                updateBackground(
                    WEATHER_CODES[weatherData.current_weather.weathercode],
                    weatherData.current_weather.time
                );
                playWeatherSound(WEATHER_CODES[weatherData.current_weather.weathercode]);
            } catch (error) {
                showError(error.message || 'Failed to fetch weather data');
            } finally {
                hideLoading();
            }
        },
        (error) => {
            showError('Unable to retrieve your location');
            hideLoading();
        }
    );
}

// Update the UI with weather data
function updateUI(data) {
    const { current, location, forecast } = data;
    
    // Update main weather info
    weatherIcon.className = `wi ${getWeatherIcon(current.condition.code, location.localtime)}`;
    weatherDescription.textContent = current.condition.text;
    
    // Update temperature based on selected unit
    updateTemperature(current);
    
    // Update other weather details
    humidity.textContent = `${current.humidity}%`;
    wind.textContent = `${current.wind_kph} km/h`;
    feelsLike.textContent = currentUnit === 'c' ? `${Math.round(current.feelslike_c)}°` : `${Math.round(current.feelslike_f)}°`;
    pressure.textContent = `${current.pressure_mb} hPa`;
    
    // Update time and date
    const localDateTime = new Date(location.localtime);
    localTime.textContent = localDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    localDate.textContent = localDateTime.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    // Update sunrise/sunset
    const sunriseTime = new Date(forecast.forecastday[0].astro.sunrise);
    const sunsetTime = new Date(forecast.forecastday[0].astro.sunset);
    sunrise.textContent = sunriseTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    sunset.textContent = sunsetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Update last updated time
    const now = new Date();
    lastUpdated.textContent = `Last updated: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// Get appropriate weather icon based on condition code and time
function getWeatherIcon(conditionCode, localtime) {
    const hour = new Date(localtime).getHours();
    const isDayTime = hour >= 6 && hour < 18;
    
    // Map Open-Meteo weather codes to Weather Icons
    const iconMap = {
        0: isDayTime ? 'wi-day-sunny' : 'wi-night-clear',
        1: isDayTime ? 'wi-day-cloudy' : 'wi-night-alt-cloudy',
        2: isDayTime ? 'wi-day-cloudy-high' : 'wi-night-alt-cloudy-high',
        3: 'wi-cloudy',
        45: 'wi-fog',
        48: 'wi-fog',
        51: 'wi-sprinkle',
        53: 'wi-sprinkle',
        55: 'wi-sprinkle',
        56: 'wi-rain-mix',
        57: 'wi-rain-mix',
        61: 'wi-rain',
        63: 'wi-rain',
        65: 'wi-rain',
        66: 'wi-rain-mix',
        67: 'wi-rain-mix',
        71: 'wi-snow',
        73: 'wi-snow',
        75: 'wi-snow',
        77: 'wi-snow',
        80: 'wi-showers',
        81: 'wi-showers',
        82: 'wi-showers',
        85: 'wi-snow-wind',
        86: 'wi-snow-wind',
        95: 'wi-thunderstorm',
        96: 'wi-thunderstorm',
        99: 'wi-thunderstorm'
    };
    
    return iconMap[conditionCode] || 'wi-day-cloudy';
}

// Update temperature display based on selected unit
function updateTemperature(current) {
    if (currentUnit === 'c') {
        currentTemp.textContent = Math.round(current.temp_c);
        feelsLike.textContent = `${Math.round(current.feelslike_c)}°`;
    } else {
        currentTemp.textContent = Math.round(current.temp_f);
        feelsLike.textContent = `${Math.round(current.feelslike_f)}°`;
    }
}

// Toggle between Celsius and Fahrenheit
function toggleUnit(unit) {
    if (currentUnit === unit) return;
    
    currentUnit = unit;
    
    if (unit === 'c') {
        celsiusBtn.classList.add('active');
        fahrenheitBtn.classList.remove('active');
    } else {
        fahrenheitBtn.classList.add('active');
        celsiusBtn.classList.remove('active');
    }
    
    if (currentWeatherData) {
        updateTemperature(currentWeatherData.current);
    }
}

// Update background based on weather condition and time
function updateBackground(condition, localtime) {
    // Remove all weather animation classes
    backgroundAnimation.className = 'background-animation';
    backgroundAnimation.classList.remove(
        'clear-day', 'clear-night', 'clouds-day', 'clouds-night',
        'rain-day', 'rain-night', 'thunderstorm', 'snow', 'mist',
        'rain-animation', 'snow-animation', 'thunder-animation'
    );
    
    const hour = new Date(localtime).getHours();
    const isDayTime = hour >= 6 && hour < 18;
    
    // Determine the background class based on weather condition and time
    let backgroundClass = '';
    let animationClass = '';
    
    const conditionLower = condition.toLowerCase();
    
    if (conditionLower.includes('clear')) {
        backgroundClass = isDayTime ? 'clear-day' : 'clear-night';
    } else if (conditionLower.includes('cloud') || conditionLower.includes('overcast')) {
        backgroundClass = isDayTime ? 'clouds-day' : 'clouds-night';
    } else if (conditionLower.includes('rain') || conditionLower.includes('drizzle')) {
        backgroundClass = isDayTime ? 'rain-day' : 'rain-night';
        animationClass = 'rain-animation';
    } else if (conditionLower.includes('thunder') || conditionLower.includes('storm')) {
        backgroundClass = 'thunderstorm';
        animationClass = 'thunder-animation';
        // Add occasional thunder flashes
        setInterval(() => {
            backgroundAnimation.style.animation = 'thunder 0.5s linear';
            setTimeout(() => {
                backgroundAnimation.style.animation = '';
            }, 500);
        }, 10000);
    } else if (conditionLower.includes('snow') || conditionLower.includes('sleet') || conditionLower.includes('blizzard')) {
        backgroundClass = 'snow';
        animationClass = 'snow-animation';
    } else if (conditionLower.includes('fog') || conditionLower.includes('mist')) {
        backgroundClass = 'mist';
    }
    
    if (backgroundClass) backgroundAnimation.classList.add(backgroundClass);
    if (animationClass) backgroundAnimation.classList.add(animationClass);
}

// Play appropriate weather sound
function playWeatherSound(condition) {
    // Stop any currently playing sound
    weatherSound.pause();
    weatherSound.currentTime = 0;
    
    const conditionLower = condition.toLowerCase();
    let soundFile = '';
    
    if (conditionLower.includes('rain') || conditionLower.includes('drizzle')) {
        soundFile = 'https://assets.mixkit.co/sfx/preview/mixkit-rain-forest-1240.mp3';
    } else if (conditionLower.includes('thunder') || conditionLower.includes('storm')) {
        soundFile = 'https://assets.mixkit.co/sfx/preview/mixkit-thunder-rain-1251.mp3';
    } else if (conditionLower.includes('wind')) {
        soundFile = 'https://assets.mixkit.co/sfx/preview/mixkit-wind-whistling-1491.mp3';
    }
    
    if (soundFile) {
        weatherSound.src = soundFile;
        weatherSound.volume = 0.3;
        weatherSound.play().catch(e => console.log('Audio play failed:', e));
    }
}

// Show loading spinner
function showLoading() {
    loadingOverlay.classList.add('active');
}

// Hide loading spinner
function hideLoading() {
    loadingOverlay.classList.remove('active');
}

// Show error modal
function showError(message) {
    errorMessage.textContent = message;
    errorModal.classList.add('active');
}