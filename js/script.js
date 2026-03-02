let searchButton = document.getElementById("search-button");
let searchInput = document.getElementById("search-input");
let locationName = document.querySelector(".location");
let todayDegree = document.querySelector(".num");
let todayCondition = document.querySelector(".custom");
let todayIcon = document.querySelector(".degree img");
let burger = document.getElementById("bur");
let secUl = document.getElementById("sec-ul");
let todayName = document.querySelector(".card1 .header-card h2:first-child");
let todayDate = document.querySelector(".card1 .header-card h2:last-child");

let nextDayNames = document.querySelectorAll(".card:not(.card1) .header-card h2");

burger.addEventListener("click", function(){
    secUl.classList.toggle("show");
});

let nextDays = document.querySelectorAll(".forecast-content");

function displayWeather(data){

    let forecast = data.forecast.forecastday;

    // ====== Today ======
    let todayDateObj = new Date(forecast[0].date);

    todayName.innerHTML = todayDateObj.toLocaleDateString("en-US", { weekday: "long" });
    todayDate.innerHTML = todayDateObj.getDate() + " " + todayDateObj.toLocaleDateString("en-US", { month: "long" });

    locationName.innerHTML = data.location.name;
    todayDegree.innerHTML = data.current.temp_c + "<sup>o</sup>C";
    todayCondition.innerHTML = data.current.condition.text;
    todayIcon.src = "https:" + data.current.condition.icon;

    // ====== Next 2 Days ======
    for(let i = 1; i < forecast.length; i++){

        let nextDateObj = new Date(forecast[i].date);

        nextDayNames[i-1].innerHTML =
            nextDateObj.toLocaleDateString("en-US", { weekday: "long" });

        nextDays[i-1].querySelector(".degree").innerHTML =
            forecast[i].day.maxtemp_c + "<sup>o</sup>C";

        nextDays[i-1].querySelector("small").innerHTML =
            forecast[i].day.mintemp_c + "<sup>o</sup>";

        nextDays[i-1].querySelector(".custom").innerHTML =
            forecast[i].day.condition.text;

        nextDays[i-1].querySelector(".forecast-icon img").src =
            "https:" + forecast[i].day.condition.icon;
    }
}

let weatherData = [];

if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        function(position) {
            let lat = position.coords.latitude;
            let lon = position.coords.longitude;
            getWeather(lat + "," + lon);
        },
        function() {
            getWeather("Cairo");
        }
    );
} else {
    getWeather("Cairo");
}
searchButton.addEventListener("click", function(){
    getWeather(searchInput.value);
});
searchInput.addEventListener("input", function(){
    if(searchInput.value.length > 2){
        getWeather(searchInput.value);
    }
});

async function getWeather(query){
    let response = await fetch(`https://api.weatherapi.com/v1/forecast.json?key=736a63a29e484e279bd224105262502&q=${query}&days=3`);;
    weatherData = await response.json();
    displayWeather(weatherData);
}




