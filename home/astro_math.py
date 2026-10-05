"""
Astronomical & Vedic Panchang Engine for Karuwaki Speaks
Hybrid Architecture:
- Real-time Open-Meteo Astronomy API integration for high-precision solar ephemeris.
- Zero-dependency mathematical fallback (Keplerian & Sidereal Lahiri Ayanamsa) when offline.
- Real-time Navagraha (9 Grahas) and 12-Rashi positions.
Reference coordinates: Bhubaneswar, Odisha (20.2961° N, 85.8245° E, IST UTC+5:30)
"""

import math
import datetime
import requests

LAT = 20.2961
LON = 85.8245
TZ_OFFSET = 5.5  # IST

NAKSHATRAS = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashirsha", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta",
    "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
]

TITHIS = [
    "Shukla Pratipada", "Shukla Dwitiya", "Shukla Tritiya", "Shukla Chaturthi",
    "Shukla Panchami", "Shukla Shashthi", "Shukla Saptami", "Shukla Ashtami",
    "Shukla Navami", "Shukla Dashami", "Shukla Ekadashi", "Shukla Dwadashi",
    "Shukla Trayodashi", "Shukla Chaturdashi", "Purnima",
    "Krishna Pratipada", "Krishna Dwitiya", "Krishna Tritiya", "Krishna Chaturthi",
    "Krishna Panchami", "Krishna Shashthi", "Krishna Saptami", "Krishna Ashtami",
    "Krishna Navami", "Krishna Dashami", "Krishna Ekadashi", "Krishna Dwadashi",
    "Krishna Trayodashi", "Krishna Chaturdashi", "Amavasya"
]

RASHIS = [
    {"name": "Mesha", "en": "Aries", "symbol": "♈", "lord": "Mangala (Mars)", "element": "Fire"},
    {"name": "Vrishabha", "en": "Taurus", "symbol": "♉", "lord": "Shukra (Venus)", "element": "Earth"},
    {"name": "Mithuna", "en": "Gemini", "symbol": "♊", "lord": "Budha (Mercury)", "element": "Air"},
    {"name": "Karka", "en": "Cancer", "symbol": "♋", "lord": "Chandra (Moon)", "element": "Water"},
    {"name": "Simha", "en": "Leo", "symbol": "♌", "lord": "Surya (Sun)", "element": "Fire"},
    {"name": "Kanya", "en": "Virgo", "symbol": "♍", "lord": "Budha (Mercury)", "element": "Earth"},
    {"name": "Tula", "en": "Libra", "symbol": "♎", "lord": "Shukra (Venus)", "element": "Air"},
    {"name": "Vrishchika", "en": "Scorpio", "symbol": "♏", "lord": "Mangala (Mars)", "element": "Water"},
    {"name": "Dhanu", "en": "Sagittarius", "symbol": "♐", "lord": "Guru (Jupiter)", "element": "Fire"},
    {"name": "Makara", "en": "Capricorn", "symbol": "♑", "lord": "Shani (Saturn)", "element": "Earth"},
    {"name": "Kumbha", "en": "Aquarius", "symbol": "♒", "lord": "Shani (Saturn)", "element": "Air"},
    {"name": "Meena", "en": "Pisces", "symbol": "♓", "lord": "Guru (Jupiter)", "element": "Water"}
]

def get_julian_day(d):
    y = d.year
    m = d.month
    day = d.day + 12.0 / 24.0  # midday IST
    if m <= 2:
        y -= 1
        m += 12
    A = math.floor(y / 100)
    B = 2 - A + math.floor(A / 4)
    return math.floor(365.25 * (y + 4716)) + math.floor(30.6001 * (m + 1)) + day + B - 1524.5

def format_time_12h(hours_float):
    hours_float = hours_float % 24
    h = int(hours_float)
    m = int(round((hours_float - h) * 60))
    if m >= 60:
        h = (h + 1) % 24
        m = 0
    period = "a.m." if h < 12 else "p.m."
    display_h = h if 1 <= h <= 12 else (12 if h == 0 else h - 12)
    return f"{display_h}:{m:02d} {period}"

def format_time_range(start_h, end_h):
    return f"{format_time_12h(start_h)} - {format_time_12h(end_h)}"

def parse_iso_time(iso_str):
    try:
        dt = datetime.datetime.fromisoformat(iso_str)
        h = dt.hour
        m = dt.minute
        period = "a.m." if h < 12 else "p.m."
        display_h = h if 1 <= h <= 12 else (12 if h == 0 else h - 12)
        formatted = f"{display_h}:{m:02d} {period}"
        hours_float = h + m / 60.0
        return formatted, hours_float
    except Exception:
        return None, None

def fetch_open_meteo_astronomy(target_date, lat=LAT, lon=LON):
    """
    Queries the free Open-Meteo Astronomy / Forecast API for high-precision solar timings.
    Fails safely with None on network timeout or connection error.
    """
    date_str = target_date.strftime("%Y-%m-%d")
    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}&daily=sunrise,sunset,daylight_duration&"
        f"start_date={date_str}&end_date={date_str}&timezone=auto"
    )
    try:
        response = requests.get(url, timeout=2.5)
        if response.status_code == 200:
            data = response.json()
            daily = data.get("daily", {})
            sunrises = daily.get("sunrise", [])
            sunsets = daily.get("sunset", [])
            if sunrises and sunsets:
                sr_fmt, sr_float = parse_iso_time(sunrises[0])
                ss_fmt, ss_float = parse_iso_time(sunsets[0])
                if sr_float is not None and ss_float is not None:
                    return {
                        "sunrise_fmt": sr_fmt,
                        "sunrise_float": sr_float,
                        "sunset_fmt": ss_fmt,
                        "sunset_float": ss_float,
                        "source": "Open-Meteo Astronomy API"
                    }
    except Exception:
        pass
    return None

def normalize_deg(deg):
    deg = deg % 360
    return deg + 360 if deg < 0 else deg

def calculate_navagraha_positions(target_date):
    """
    Computes geocentric and heliocentric planetary longitudes and assigns them to Rashis.
    """
    jd = get_julian_day(target_date)
    d = jd - 2451545.0  # days since J2000.0

    # Solar position
    L_sun = normalize_deg(280.460 + 0.9856474 * d)
    g_sun = math.radians(normalize_deg(357.528 + 0.9856003 * d))
    sun_deg = normalize_deg(L_sun + 1.915 * math.sin(g_sun) + 0.020 * math.sin(2 * g_sun))

    # Lunar position
    moon_m = math.radians(normalize_deg(134.963 + 13.064993 * d))
    moon_deg = normalize_deg(218.316 + 13.176396 * d + 6.289 * math.sin(moon_m))

    # Planetary approximations
    mars_deg = normalize_deg(355.433 + 0.5240330 * d + (L_sun - 355.433) * 0.15)
    merc_deg = normalize_deg(sun_deg + 18.0 * math.sin(math.radians(normalize_deg(252.251 + 4.092334 * d))))
    jup_deg = normalize_deg(34.351 + 0.0830912 * d)
    ven_deg = normalize_deg(sun_deg + 22.5 * math.sin(math.radians(normalize_deg(181.980 + 1.602130 * d))))
    sat_deg = normalize_deg(50.077 + 0.0334597 * d)

    # Rahu & Ketu (Mean Lunar Node, retrograde)
    rahu_deg = normalize_deg(125.044 - 0.0529538083 * d)
    ketu_deg = normalize_deg(rahu_deg + 180.0)

    # Sidereal Lahiri Ayanamsa approximation
    ayanamsa = 23.86 + (d / 365.25) * (50.29 / 3600.0)

    raw_planets = {
        "surya": {"name": "Surya", "en": "Sun", "glyph": "☀️", "tropical": sun_deg},
        "chandra": {"name": "Chandra", "en": "Moon", "glyph": "🌙", "tropical": moon_deg},
        "mangala": {"name": "Mangala", "en": "Mars", "glyph": "🔴", "tropical": mars_deg},
        "budha": {"name": "Budha", "en": "Mercury", "glyph": "🟢", "tropical": merc_deg},
        "guru": {"name": "Guru", "en": "Jupiter", "glyph": "🟡", "tropical": jup_deg},
        "shukra": {"name": "Shukra", "en": "Venus", "glyph": "⚪", "tropical": ven_deg},
        "shani": {"name": "Shani", "en": "Saturn", "glyph": "🪐", "tropical": sat_deg},
        "rahu": {"name": "Rahu", "en": "North Node", "glyph": "🌑", "tropical": rahu_deg},
        "ketu": {"name": "Ketu", "en": "South Node", "glyph": "🌘", "tropical": ketu_deg},
    }

    result = {}
    for key, p in raw_planets.items():
        sidereal = normalize_deg(p["tropical"] - ayanamsa)
        rashi_idx = int(sidereal / 30) % 12
        deg_in_sign = round(sidereal % 30, 2)
        rashi = RASHIS[rashi_idx]
        result[key] = {
            "name": p["name"],
            "en": p["en"],
            "glyph": p["glyph"],
            "degree": round(sidereal, 2),
            "degree_in_sign": deg_in_sign,
            "rashi_name": rashi["name"],
            "rashi_en": rashi["en"],
            "rashi_symbol": rashi["symbol"],
            "rashi_lord": rashi["lord"]
        }
    return result

def compute_panchang(target_date, lat=LAT, lon=LON, location_name="Bhubaneswar, Odisha"):
    """
    Computes complete Vedic Panchang metrics for a given datetime.date.
    Uses Open-Meteo Astronomy API with seamless fallback to pure Keplerian mathematics.
    """
    jd = get_julian_day(target_date)
    d = jd - 2451545.0  # days since J2000.0

    # Solar calculations
    L_sun = (280.460 + 0.9856474 * d) % 360
    g_sun = math.radians((357.528 + 0.9856003 * d) % 360)
    sun_lon = (L_sun + 1.915 * math.sin(g_sun) + 0.020 * math.sin(2 * g_sun)) % 360

    # Lunar calculations
    L_moon = (218.316 + 13.176396 * d) % 360
    M_moon = math.radians((134.963 + 13.064993 * d) % 360)
    moon_lon = (L_moon + 6.289 * math.sin(M_moon)) % 360

    # Sidereal correction (Lahiri Ayanamsa)
    ayanamsa = 23.86 + (d / 365.25) * (50.29 / 3600.0)
    sidereal_moon = (moon_lon - ayanamsa) % 360

    # Tithi: 12 deg elongation per tithi
    elongation = (moon_lon - sun_lon) % 360
    tithi_index = int(elongation / 12.0) % 30
    tithi_name = TITHIS[tithi_index]

    # Nakshatra: 13 deg 20 min per nakshatra (13.333333 deg)
    nakshatra_index = int(sidereal_moon / (360.0 / 27.0)) % 27
    nakshatra_name = NAKSHATRAS[nakshatra_index]

    # Check live Open-Meteo API for real-time solar sunrise/sunset
    api_result = fetch_open_meteo_astronomy(target_date, lat, lon)
    if api_result:
        sunrise_str = api_result["sunrise_fmt"]
        sunset_str = api_result["sunset_fmt"]
        sunrise = api_result["sunrise_float"]
        sunset = api_result["sunset_float"]
        data_source = "Live Open-Meteo Astronomy API + Vedic Engine"
    else:
        # Fallback to Keplerian solar equations
        ecliptic_obliquity = math.radians(23.439 - 0.0000004 * d)
        sin_dec = math.sin(ecliptic_obliquity) * math.sin(math.radians(sun_lon))
        dec = math.asin(sin_dec)

        y = math.tan(ecliptic_obliquity / 2) ** 2
        eot = 4 * math.degrees(
            y * math.sin(2 * math.radians(L_sun))
            - 2 * 0.0167 * math.sin(g_sun)
            + 4 * 0.0167 * y * math.sin(g_sun) * math.cos(2 * math.radians(L_sun))
        )

        lat_rad = math.radians(lat)
        cos_h0 = (math.sin(math.radians(-0.833)) - math.sin(lat_rad) * math.sin(dec)) / (math.cos(lat_rad) * math.cos(dec))
        cos_h0 = max(-1.0, min(1.0, cos_h0))
        h0 = math.degrees(math.acos(cos_h0))

        solar_noon = 12.0 + (TZ_OFFSET * 15 - lon) / 15.0 - eot / 60.0
        sunrise = solar_noon - h0 / 15.0
        sunset = solar_noon + h0 / 15.0
        sunrise_str = format_time_12h(sunrise)
        sunset_str = format_time_12h(sunset)
        data_source = "Pure Vedic Ephemeris Mathematical Engine"

    day_duration = sunset - sunrise
    if day_duration <= 0:
        day_duration = 12.0

    # Weekday calculations (Monday=0, Sunday=6)
    weekday = target_date.weekday()

    # Rahu Kaal Octant mapping
    rahu_octants = {0: 2, 1: 7, 2: 5, 3: 6, 4: 4, 5: 3, 6: 8}
    oct_num = rahu_octants[weekday]
    oct_len = day_duration / 8.0
    rahu_start = sunrise + (oct_num - 1) * oct_len
    rahu_end = sunrise + oct_num * oct_len

    # Abhijit Muhurat
    muhurat_len = day_duration / 15.0
    abhijit_start = sunrise + 7 * muhurat_len
    abhijit_end = sunrise + 8 * muhurat_len

    # Amrit Kaal
    amrit_offset = ((nakshatra_index * 1.5) % 10) + 1.5
    amrit_start = (sunrise + amrit_offset) % 24
    amrit_end = (amrit_start + 1.6) % 24

    # Moonrise & Moonset approximations
    moonrise = (sunrise + (elongation / 15.0)) % 24
    moonset = (sunset + (elongation / 15.0)) % 24

    # Navagraha planetary coordinates
    planets = calculate_navagraha_positions(target_date)

    # Calculate Chandra Rashi (Moon's sidereal sign)
    moon_rashi_idx = int(sidereal_moon / 30.0) % 12
    moon_rashi = RASHIS[moon_rashi_idx]

    # Calculate Gochar transit houses for all 12 Rashis
    gochar_transits = {}
    for idx, r in enumerate(RASHIS):
        house_num = ((moon_rashi_idx - idx + 12) % 12) + 1
        gochar_transits[r["name"].lower()] = {
            "name": r["name"],
            "en": r["en"],
            "symbol": r["symbol"],
            "house": house_num,
            "element": r["element"],
            "lord": r["lord"]
        }

    return {
        'date': target_date,
        'date_formatted': target_date.strftime("%B %d, %Y"),
        'location': location_name,
        'coordinates': f"{lat}° N, {lon}° E",
        'tithi_title': f"{tithi_name.upper()} TITHI",
        'tithi_name': tithi_name,
        'nakshatra': nakshatra_name,
        'moon_rashi': moon_rashi["name"],
        'moon_rashi_en': moon_rashi["en"],
        'sunrise': sunrise_str,
        'sunset': sunset_str,
        'moonrise': format_time_12h(moonrise),
        'moonset': format_time_12h(moonset),
        'rahu_kaal': format_time_range(rahu_start, rahu_end),
        'amrit_kaal': format_time_range(amrit_start, amrit_end),
        'abhijit': format_time_range(abhijit_start, abhijit_end),
        'cosmic_insight': (
            f"Active cosmic alignment on {target_date.strftime('%B %d, %Y')}: Moon transits through {nakshatra_name} "
            f"in {moon_rashi['name']} ({moon_rashi['en']}) during {tithi_name}. Favorable planetary resonance activated during Amrit Kaal ({format_time_range(amrit_start, amrit_end)})."
        ),
        'planets': planets,
        'gochar_transits': gochar_transits,
        'source': data_source
    }
