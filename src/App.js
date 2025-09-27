import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [city, setCity] = useState("");
  const [weather, setWeather] = useState(null);
  const [error, setError] = useState("");
  const [description, setDescription] = useState("");
  const [dateTime, setDateTime] = useState("");

  const getWeatherEmoji = (code) => {
    if (code === 0) return "☀️";
    if (code >= 1 && code <= 3) return "⛅";
    if (code >= 45 && code <= 48) return "🌫️";
    if (code >= 51 && code <= 67) return "🌧️";
    if (code >= 71 && code <= 77) return "❄️";
    if (code >= 80 && code <= 82) return "🌦️";
    if (code >= 95) return "⛈️";
    return "🌡️";
  };

  const getBackgroundClass = () => {
    if (!weather) return "bg-default";
    const code = weather.weatherCode;
    if (code === 0) return "bg-sunny";
    if (code >= 1 && code <= 3) return "bg-partly-cloudy";
    if (code >= 51 && code <= 67) return "bg-rainy";
    if (code >= 71 && code <= 77) return "bg-snowy";
    if (code >= 95) return "bg-stormy";
    return "bg-default";
  };

  const fetchWeather = async () => {
    setError("");
    setWeather(null);
    setDescription("");

    if (!city) {
      setError("Please enter a city name.");
      return;
    }

    try {
      // Get city coordinates
      const geoRes = await axios.get(
        `https://geocoding-api.open-meteo.com/v1/search?name=${city}`
      );

      if (!geoRes.data.results || geoRes.data.results.length === 0) {
        setError("City not found.");
        return;
      }

      const { latitude, longitude, name, country } = geoRes.data.results[0];
      fetchWeatherByCoords(latitude, longitude, name, country);
    } catch (err) {
      console.error(err);
      setError("Error fetching weather data.");
    }
  };

  // Function to fetch weather by coordinates
  const fetchWeatherByCoords = async (latitude, longitude, name, country) => {
    try {
      const weatherRes = await axios.get(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=relativehumidity_2m`
      );

      const humidity = weatherRes.data.hourly.relativehumidity_2m[0] || 50;
      const temperature = weatherRes.data.current_weather.temperature;
      const windspeed = weatherRes.data.current_weather.windspeed;
      const weatherCode = weatherRes.data.current_weather.weathercode;
      const feelsLike = Math.round(
        temperature - (100 - humidity) / 5 + windspeed / 5
      );

      const weatherData = { city: name, country, temperature, windspeed, weatherCode, humidity, feelsLike };
      setWeather(weatherData);

      // Call backend for LLM description
      const llmRes = await axios.post("http://localhost:5000/api/describe-weather", {
        city: name,
        temperature,
        humidity,
        windspeed,
        weather: getWeatherEmoji(weatherCode),
      });

      setDescription(llmRes.data.description);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch weather description.");
    }
  };

  // useEffect for geolocation and date/time
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          axios
            .get(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}`)
            .then((geoRes) => {
              const name = geoRes.data.name || "Unknown";
              const country = geoRes.data.country || "";
              setCity(name);
              fetchWeatherByCoords(latitude, longitude, name, country);
            })
            .catch(() => setError("Failed to fetch your location weather."));
        },
        () => setError("Location permission denied. Please enter a city manually.")
      );
    }

    const interval = setInterval(() => {
      const now = new Date();
      setDateTime(now.toLocaleString());
    }, 1000);

    return () => clearInterval(interval);
  }, []); // eslint warning removed

  return (
    <div className={`container ${getBackgroundClass()}`}>
      <header className="header">
        <h1>Weather Now 🌤️</h1>
        <p>{dateTime}</p>
      </header>

      <div className="search-container">
        <input
          type="text"
          placeholder="Enter city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchWeather()}
        />
        <button onClick={fetchWeather}>Search</button>
      </div>

      {error && <p className="error">{error}</p>}

      {weather && (
        <div className="weather-card">
          <div className="weather-main">
            <div className="emoji">{getWeatherEmoji(weather.weatherCode)}</div>
            <div className="temp-info">
              <h2>
                {weather.city}, {weather.country}
              </h2>
              <p className="temperature">{weather.temperature}°C</p>
              <p className="feels-like">Feels Like: {weather.feelsLike}°C</p>
            </div>
          </div>

          <div className="weather-details">
            <p>🌬️ Wind: {weather.windspeed} km/h</p>
            <p>💧 Humidity: {weather.humidity}%</p>
          </div>

          <div className="llm-description">
            <p>{description}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
