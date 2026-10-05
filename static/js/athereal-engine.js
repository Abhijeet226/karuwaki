/**
 * ATHEREAL 2026 - ASTRONOMICAL EPHEMERIS & RASHI SYNTHESIZER ENGINE
 * Pure mathematical client-side Vedic planetary orbit calculator & daily guidance synthesizer.
 * Zero external dependencies. 100% automated.
 */

(function() {
    'use strict';

    // ── 1. CONSTANTS & METAPHYSICAL DATA ──
    const RASHIS = [
        { id: 0, name: 'Mesha', en: 'Aries', symbol: '♈', element: 'Fire', lord: 'Mangala (Mars)', root: 9, primaryColor: 'Crimson' },
        { id: 1, name: 'Vrishabha', en: 'Taurus', symbol: '♉', element: 'Earth', lord: 'Shukra (Venus)', root: 6, primaryColor: 'Forest Jade' },
        { id: 2, name: 'Mithuna', en: 'Gemini', symbol: '♊', element: 'Air', lord: 'Budha (Mercury)', root: 5, primaryColor: 'Cyber Mint' },
        { id: 3, name: 'Karka', en: 'Cancer', symbol: '♋', element: 'Water', lord: 'Chandra (Moon)', root: 2, primaryColor: 'Sea Pearl' },
        { id: 4, name: 'Simha', en: 'Leo', symbol: '♌', element: 'Fire', lord: 'Surya (Sun)', root: 1, primaryColor: 'Radiant Gold' },
        { id: 5, name: 'Kanya', en: 'Virgo', symbol: '♍', element: 'Earth', lord: 'Budha (Mercury)', root: 5, primaryColor: 'Amber Olive' },
        { id: 6, name: 'Tula', en: 'Libra', symbol: '♎', element: 'Air', lord: 'Shukra (Venus)', root: 6, primaryColor: 'Rose Quartz' },
        { id: 7, name: 'Vrishchika', en: 'Scorpio', symbol: '♏', element: 'Water', lord: 'Mangala (Mars)', root: 9, primaryColor: 'Deep Scarlet' },
        { id: 8, name: 'Dhanu', en: 'Sagittarius', symbol: '♐', element: 'Fire', lord: 'Guru (Jupiter)', root: 3, primaryColor: 'Saffron Topaz' },
        { id: 9, name: 'Makara', en: 'Capricorn', symbol: '♑', element: 'Earth', lord: 'Shani (Saturn)', root: 8, primaryColor: 'Obsidian Cobalt' },
        { id: 10, name: 'Kumbha', en: 'Aquarius', symbol: '♒', element: 'Air', lord: 'Shani (Saturn)', root: 8, primaryColor: 'Electric Indigo' },
        { id: 11, name: 'Meena', en: 'Pisces', symbol: '♓', element: 'Water', lord: 'Guru (Jupiter)', root: 3, primaryColor: 'Aquamarine Champagne' }
    ];

    const DAY_LORDS_VARA = [
        { name: "Surya", num: 1, colorName: "Solar Gold" },      // Sunday (0)
        { name: "Chandra", num: 2, colorName: "Silver Pearl" },   // Monday (1)
        { name: "Mangala", num: 9, colorName: "Deep Crimson" },   // Tuesday (2)
        { name: "Budha", num: 5, colorName: "Emerald Mint" },     // Wednesday (3)
        { name: "Guru", num: 3, colorName: "Saffron Amber" },     // Thursday (4)
        { name: "Shukra", num: 6, colorName: "Rose Gold" },       // Friday (5)
        { name: "Shani", num: 8, colorName: "Electric Cobalt" }   // Saturday (6)
    ];

    const GRAHAS_META = {
        surya: { name: 'Surya', en: 'Sun', glyph: '☀️', color: '#FFD700', nature: 'Soul, Leadership & Vitality', dignity: 'Royal' },
        chandra: { name: 'Chandra', en: 'Moon', glyph: '🌙', color: '#E0E8FF', nature: 'Mind, Emotions & Intuition', dignity: 'Perceptive' },
        mangala: { name: 'Mangala', en: 'Mars', glyph: '🔴', color: '#FF4D4D', nature: 'Willpower, Action & Courage', dignity: 'Commanding' },
        budha: { name: 'Budha', en: 'Mercury', glyph: '🟢', color: '#C1FF72', nature: 'Intellect, Commerce & Logic', dignity: 'Analytical' },
        guru: { name: 'Guru', en: 'Jupiter', glyph: '🟡', color: '#FFC837', nature: 'Higher Wisdom, Dharma & Prosperity', dignity: 'Expansive' },
        shukra: { name: 'Shukra', en: 'Venus', glyph: '⚪', color: '#EE3EC9', nature: 'Aesthetics, Harmony & Synthesis', dignity: 'Creative' },
        shani: { name: 'Shani', en: 'Saturn', glyph: '🪐', color: '#6A93CB', nature: 'Discipline, Karma & Perseverance', dignity: 'Steadfast' },
        rahu: { name: 'Rahu', en: 'North Node', glyph: '🌑', color: '#A855F7', nature: 'Innovation, Amplification & Ambition', dignity: 'Shadow' },
        ketu: { name: 'Ketu', en: 'South Node', glyph: '🌘', color: '#06B6D4', nature: 'Spiritual Liberation & Detachment', dignity: 'Transcendent' }
    };

    // ── 2. ASTRONOMICAL EPHEMERIS MATHEMATICS ──
    function getJulianDay(date) {
        let year = date.getUTCFullYear();
        let month = date.getUTCMonth() + 1;
        const day = date.getUTCDate() + (date.getUTCHours() + date.getUTCMinutes() / 60) / 24;

        if (month <= 2) {
            year -= 1;
            month += 12;
        }
        const A = Math.floor(year / 100);
        const B = 2 - A + Math.floor(A / 4);
        return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
    }

    function normalizeDeg(deg) {
        deg = deg % 360;
        return deg < 0 ? deg + 360 : deg;
    }

    function calculatePlanetaryPositions(targetDate) {
        const jd = getJulianDay(targetDate);
        const d = jd - 2451545.0; // days since J2000.0

        // Sun Mean Longitude
        const L_sun = normalizeDeg(280.460 + 0.9856474 * d);
        const g_sun = normalizeDeg(357.528 + 0.9856003 * d) * (Math.PI / 180);
        const sunDeg = normalizeDeg(L_sun + 1.915 * Math.sin(g_sun) + 0.020 * Math.sin(2 * g_sun));

        // Moon Mean Longitude
        const moonDeg = normalizeDeg(218.316 + 13.176396 * d + 6.289 * Math.sin(normalizeDeg(134.963 + 13.064993 * d) * (Math.PI / 180)));

        // Heliocentric / Geocentric approximations
        const marsDeg = normalizeDeg(355.433 + 0.5240330 * d + (L_sun - 355.433) * 0.15);
        const mercDeg = normalizeDeg(sunDeg + 18.0 * Math.sin(normalizeDeg(252.251 + 4.092334 * d) * (Math.PI / 180)));
        const jupDeg = normalizeDeg(34.351 + 0.0830912 * d);
        const venDeg = normalizeDeg(sunDeg + 22.5 * Math.sin(normalizeDeg(181.980 + 1.602130 * d) * (Math.PI / 180)));
        const satDeg = normalizeDeg(50.077 + 0.0334597 * d);

        // Rahu (Mean Lunar Node, moves retrograde ~19.34 deg/year)
        const rahuDeg = normalizeDeg(125.044 - 0.0529538083 * d);
        const ketuDeg = normalizeDeg(rahuDeg + 180);

        return {
            surya: sunDeg,
            chandra: moonDeg,
            mangala: marsDeg,
            budha: mercDeg,
            guru: jupDeg,
            shukra: venDeg,
            shani: satDeg,
            rahu: rahuDeg,
            ketu: ketuDeg
        };
    }

    function degToSign(deg) {
        const index = Math.floor(deg / 30);
        const signDeg = deg % 30;
        const rashi = RASHIS[index % 12];
        return {
            rashi: rashi,
            degreesInSign: signDeg.toFixed(1),
            totalDeg: deg.toFixed(1)
        };
    }

    // ── 3. RENDER CELESTIAL TRANSIT WHEEL (SVG) ──
    let currentSelectedPlanet = 'surya';
    let currentPlanetsData = {};

    function renderWheel(positions) {
        const svg = document.getElementById('celestial-wheel-svg');
        if (!svg) return;

        currentPlanetsData = positions;
        const centerX = 240;
        const centerY = 240;
        const radius = 195;
        const innerRadius = 145;

        // Clear previous dynamic elements
        const oldGroup = document.getElementById('wheel-dynamic-group');
        if (oldGroup) oldGroup.remove();

        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.id = 'wheel-dynamic-group';

        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const sectorEvenFill = isLight ? 'rgba(15,23,42,0.02)' : 'rgba(255,255,255,0.02)';
        const sectorOddFill = isLight ? 'rgba(190,24,93,0.04)' : 'rgba(238,62,201,0.03)';
        const sectorStroke = isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.08)';
        const textFill = isLight ? '#0f172a' : 'rgba(255,255,255,0.75)';
        const nodeFill = isLight ? '#ffffff' : '#020b22';

        // 1. Draw 12 Rashi Sectors
        for (let i = 0; i < 12; i++) {
            const startAngle = (i * 30 - 90) * (Math.PI / 180);
            const endAngle = ((i + 1) * 30 - 90) * (Math.PI / 180);

            const x1 = centerX + radius * Math.cos(startAngle);
            const y1 = centerY + radius * Math.sin(startAngle);
            const x2 = centerX + radius * Math.cos(endAngle);
            const y2 = centerY + radius * Math.sin(endAngle);

            const x3 = centerX + innerRadius * Math.cos(endAngle);
            const y3 = centerY + innerRadius * Math.sin(endAngle);
            const x4 = centerX + innerRadius * Math.cos(startAngle);
            const y4 = centerY + innerRadius * Math.sin(startAngle);

            const pathD = `M ${x4} ${y4} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 0 0 ${x4} ${y4} Z`;

            const sector = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            sector.setAttribute('d', pathD);
            sector.setAttribute('class', i % 2 === 0 ? 'wheel-sector-even' : 'wheel-sector-odd');
            sector.setAttribute('fill', i % 2 === 0 ? sectorEvenFill : sectorOddFill);
            sector.setAttribute('stroke', sectorStroke);
            sector.setAttribute('stroke-width', '1');
            group.appendChild(sector);

            // Rashi Symbol
            const midAngle = ((i * 30 + 15) - 90) * (Math.PI / 180);
            const textX = centerX + (radius - 22) * Math.cos(midAngle);
            const textY = centerY + (radius - 22) * Math.sin(midAngle) + 4;

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', textX);
            text.setAttribute('y', textY);
            text.setAttribute('fill', textFill);
            text.setAttribute('class', 'rashi-symbol-text');
            text.setAttribute('font-size', '12');
            text.setAttribute('font-family', 'sans-serif');
            text.setAttribute('text-anchor', 'middle');
            text.textContent = RASHIS[i].symbol;
            group.appendChild(text);
        }

        // 2. Plot 9 Grahas on Orbit
        const planetOrbitRadius = 105;
        Object.keys(positions).forEach(key => {
            const deg = positions[key];
            const meta = GRAHAS_META[key];
            const angle = (deg - 90) * (Math.PI / 180);

            const px = centerX + planetOrbitRadius * Math.cos(angle);
            const py = centerY + planetOrbitRadius * Math.sin(angle);

            // Connect line to center
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', centerX);
            line.setAttribute('y1', centerY);
            line.setAttribute('x2', px);
            line.setAttribute('y2', py);
            line.setAttribute('stroke', meta.color);
            line.setAttribute('stroke-width', '0.7');
            line.setAttribute('stroke-dasharray', '2,3');
            line.setAttribute('opacity', '0.4');
            group.appendChild(line);

            // Planet Node
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.style.cursor = 'pointer';
            g.setAttribute('class', 'planet-node');
            g.setAttribute('data-planet', key);

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', px);
            circle.setAttribute('cy', py);
            circle.setAttribute('r', '13');
            circle.setAttribute('class', 'planet-node-circle');
            circle.setAttribute('fill', nodeFill);
            circle.setAttribute('stroke', meta.color);
            circle.setAttribute('stroke-width', key === currentSelectedPlanet ? '2.5' : '1.5');
            g.appendChild(circle);

            const glyph = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            glyph.setAttribute('x', px);
            glyph.setAttribute('y', py + 4);
            glyph.setAttribute('font-size', '11');
            glyph.setAttribute('text-anchor', 'middle');
            glyph.textContent = meta.glyph;
            g.appendChild(glyph);

            g.addEventListener('click', () => {
                selectPlanet(key);
            });

            group.appendChild(g);
        });

        svg.appendChild(group);
        selectPlanet(currentSelectedPlanet);
    }

    function selectPlanet(planetKey) {
        currentSelectedPlanet = planetKey;
        const meta = GRAHAS_META[planetKey];
        const deg = currentPlanetsData[planetKey] || 0;
        const signInfo = degToSign(deg);

        // Update Dossier Panel
        const card = document.getElementById('planet-dossier-card');
        if (!card) return;

        card.innerHTML = `
            <div class="d-flex align-items-center gap-3 mb-3">
                <div style="width:52px; height:52px; border-radius:var(--radius-md); background:var(--bg-elevated); border:1.5px solid ${meta.color}; display:flex; align-items:center; justify-content:center; font-size:24px; box-shadow:0 0 20px ${meta.color}33;">
                    ${meta.glyph}
                </div>
                <div>
                    <h3 style="font-family:var(--font-brand); font-size:var(--text-lg); font-weight:800; color:var(--text-primary); margin:0;">
                        ${meta.name} <span style="font-size:var(--text-xs); color:var(--text-muted); font-family:var(--font-sans); font-weight:600;">(${meta.en.toUpperCase()})</span>
                    </h3>
                    <span style="font-family:var(--font-sans); font-size:var(--text-xs); font-weight:700; letter-spacing:1px; color:${meta.color};">
                        ${meta.dignity.toUpperCase()} DIGNITY · ${meta.nature}
                    </span>
                </div>
            </div>

            <div class="row no-gutters p-3 mb-3" style="background:var(--bg-elevated); border:1px solid var(--border-card); border-radius:var(--radius-md);">
                <div class="col-6 mb-2">
                    <span style="font-size:var(--text-xs); color:var(--text-muted); font-family:var(--font-sans); font-weight:600; letter-spacing:0.5px; display:block;">TRANSIT SECTOR</span>
                    <strong style="color:var(--text-primary); font-size:var(--text-sm); font-family:var(--font-sans); font-weight:700;">${signInfo.rashi.symbol} ${signInfo.rashi.name} (${signInfo.rashi.en})</strong>
                </div>
                <div class="col-6 mb-2">
                    <span style="font-size:var(--text-xs); color:var(--text-muted); font-family:var(--font-sans); font-weight:600; letter-spacing:0.5px; display:block;">SECTOR DEGREE</span>
                    <strong style="color:var(--accent-green); font-size:var(--text-sm); font-family:var(--font-sans); font-weight:700;">${signInfo.degreesInSign}° in ${signInfo.rashi.name}</strong>
                </div>
                <div class="col-6">
                    <span style="font-size:var(--text-xs); color:var(--text-muted); font-family:var(--font-sans); font-weight:600; letter-spacing:0.5px; display:block;">ELEMENT</span>
                    <strong style="color:var(--text-primary); font-size:var(--text-sm); font-family:var(--font-sans); font-weight:700;">${signInfo.rashi.element}</strong>
                </div>
                <div class="col-6">
                    <span style="font-size:var(--text-xs); color:var(--text-muted); font-family:var(--font-sans); font-weight:600; letter-spacing:0.5px; display:block;">RULING LORD</span>
                    <strong style="color:var(--text-primary); font-size:var(--text-sm); font-family:var(--font-sans); font-weight:700;">${signInfo.rashi.lord}</strong>
                </div>
            </div>

            <p style="font-family:var(--font-sans); font-size:var(--text-sm); color:var(--text-secondary); line-height:1.6; margin-bottom:0;">
                <b>Cosmic Vibration:</b> ${meta.name} transiting through ${signInfo.rashi.name} activates ${signInfo.rashi.element.toLowerCase()} dynamics, channeling strong focus into ${meta.nature.toLowerCase()}.
            </p>
        `;

        // Highlight active planet button
        document.querySelectorAll('.planet-pill-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-planet') === planetKey);
        });
    }

    // ── 4. MULTI-VECTOR VEDIC GOCHAR & NAKSHATRA SYNTHESIZER ──
    const BHAVAS_GOCHAR = {
        1: {
            sanskrit: "Janma Bhava",
            name: "Self & Vitality",
            theme: "Personal Radiance & Initiative",
            tone: "⚡ High Vitality & Leadership",
            badgeClass: "badge bg-info-subtle text-info border border-info-subtle",
            action: "Moon transits your 1st house of Self. Physical stamina and charismatic presence peak today. Your mind is unusually sharp; initiate key personal dispatches or lead critical meetings."
        },
        2: {
            sanskrit: "Dhana Bhava",
            name: "Wealth & Speech",
            theme: "Capital Structuring & Asset Clarity",
            tone: "💰 Material Gain & Liquidity",
            badgeClass: "badge bg-success-subtle text-success border border-success-subtle",
            action: "Moon illuminates your 2nd house of Assets. Optimal cosmic window for budget allocation, commercial negotiations, and pricing strategy. Your voice carries persuasion in family and financial matters."
        },
        3: {
            sanskrit: "Bhratru Bhava",
            name: "Enterprise & Courage",
            theme: "Outreach & Decisive Momentum",
            tone: "🚀 Creative Velocity",
            badgeClass: "badge bg-warning-subtle text-warning border border-warning-subtle",
            action: "Moon activates your 3rd house of Initiative. Exceptional day for outreach, technical publishing, networking, and creative campaigns. Calculated boldness delivers rapid progress."
        },
        4: {
            sanskrit: "Sukha Bhava",
            name: "Inner Core & Stability",
            theme: "Domestic Harmony & Foundation",
            tone: "🏡 Grounding & Calm",
            badgeClass: "badge bg-primary-subtle text-primary border border-primary-subtle",
            action: "Moon settles into your 4th house of Emotional Anchoring. Focus on infrastructure, system foundations, and domestic balance. Avoid emotional skirmishes; protect your creative sanctuary."
        },
        5: {
            sanskrit: "Putra & Buddhi Bhava",
            name: "Intellect & Speculation",
            theme: "Creative Genius & Intuition",
            tone: "✨ High Intuition & Innovation",
            badgeClass: "badge bg-info-subtle text-info border border-info-subtle",
            action: "Moon activates your 5th house of Higher Mind. Brilliant creative flow, sharp strategic intuition, and rapid artistic synthesis. Ideal for prototyping new concepts, design, and speculative clarity."
        },
        6: {
            sanskrit: "Shatru & Roga Bhava",
            name: "Victory & Discipline",
            theme: "Clearing Hurdles & Task Mastery",
            tone: "⚔️ Competitive Triumph",
            badgeClass: "badge bg-success-subtle text-success border border-success-subtle",
            action: "Moon transits your 6th house of Overcoming Obstacles. Superb alignment for clearing backlogs, resolving technical bugs, and enforcing fitness or work disciplines. Complex hurdles yield to methodical focus."
        },
        7: {
            sanskrit: "Jaya Bhava",
            name: "Partnerships & Alliances",
            theme: "Collaborative Synergy & Contracts",
            tone: "🤝 Alliance Synergy",
            badgeClass: "badge bg-warning-subtle text-warning border border-warning-subtle",
            action: "Moon activates your 7th house of Unions and Public Relations. Favorable for contract negotiations, strategic partnerships, and establishing shared roadmaps with co-creators or key allies."
        },
        8: {
            sanskrit: "Randhra Bhava (Ashtama)",
            name: "Deep Transformation",
            theme: "Introspection & Strategic Restraint",
            tone: "🛡️ Strategic Restraint (Ashtama Chandra)",
            badgeClass: "badge bg-danger-subtle text-danger border border-danger-subtle",
            action: "Ashtama Chandra: Moon traverses your 8th house of Hidden Dynamics. Exercise deliberate composure. Defer aggressive financial moves or heated confrontations. Outstanding alignment for deep research, debugging, and esoteric introspection."
        },
        9: {
            sanskrit: "Bhagya Bhava",
            name: "Fortune & Dharma",
            theme: "Higher Wisdom & Auspicious Vision",
            tone: "🌟 Dharmic Providence",
            badgeClass: "badge bg-success-subtle text-success border border-success-subtle",
            action: "Moon graces your 9th house of Dharma and Providence. Exceptional auspicious resonance for learning, long-range planning, mentorship, and high-road ethical decisions. Broader perspectives unlock solutions."
        },
        10: {
            sanskrit: "Karma Bhava",
            name: "Executive Power & Status",
            theme: "Leadership Authority & Recognition",
            tone: "👑 Peak Professional Influence",
            badgeClass: "badge bg-info-subtle text-info border border-info-subtle",
            action: "Moon ascends into your 10th house of Public Authority. Executive decisions made today carry lasting weight. Favorable for product launches, stakeholder presentations, and career milestones."
        },
        11: {
            sanskrit: "Labha Bhava",
            name: "Gains & Community",
            theme: "Network Inflow & Aspirations",
            tone: "📈 Expansion & Inflow",
            badgeClass: "badge bg-success-subtle text-success border border-success-subtle",
            action: "Moon illuminates your 11th house of Fulfillment and Alliances. Powerful magnet for community expansion, network goodwill, and harvesting returns from past efforts. Collaborative goals receive strong backing."
        },
        12: {
            sanskrit: "Vyaya Bhava",
            name: "Restoration & Subconscious",
            theme: "Spiritual Recharge & Detachment",
            tone: "🧘 Contemplative Healing",
            badgeClass: "badge bg-secondary-subtle text-secondary border border-secondary-subtle",
            action: "Moon enters your 12th house of Solitude and Release. Energy draws inward. Defer non-urgent public disputes; utilize this window for quiet drafting, strategic reflection, and shedding mental baggage."
        }
    };

    const NAKSHATRAS_METAPHYSICS = {
        "ashwini": { deity: "Ashvini Kumaras", shakti: "Kshipra (Swift Initiation)", vibe: "Surge of pioneering mental velocity; cut through procrastination and spark fresh beginnings." },
        "bharani": { deity: "Yama (Cosmic Justice)", shakti: "Apabharani (Transformative Purge)", vibe: "Disciplined boundary-setting; purge unproductive processes and embrace necessary transitions." },
        "krittika": { deity: "Agni (Sacred Fire)", shakti: "Dahana (Decisive Purification)", vibe: "Penetrating razor-sharp focus; eliminates mental clutter and burnishes core intentions." },
        "rohini": { deity: "Brahma (Creator)", shakti: "Rohana (Fertile Manifestation)", vibe: "Rich imaginative fertility and aesthetic charm; ideal for designing, building, and sensory growth." },
        "mrigashirsha": { deity: "Soma (Moon/Nectar)", shakti: "Prinana (The Questing Seeker)", vibe: "Curious investigative restlessness; research, probe data, and uncover buried connections." },
        "ardra": { deity: "Rudra (Storm Transformer)", shakti: "Yatna (Breakthrough Clarity)", vibe: "Electrifying emotional tempest that tears down illusions; profound breakthroughs follow honest realization." },
        "punarvasu": { deity: "Aditi (Cosmic Mother)", shakti: "Vasutva (Return of the Light)", vibe: "Renewed hope, emotional resilience, and boundless optimism; healing after disruption." },
        "pushya": { deity: "Brihaspati (High Guru)", shakti: "Brahmavarchasa (Highest Benevolence)", vibe: "Supreme nourishment and dharmic stability; most auspicious star for foundational decisions." },
        "ashlesha": { deity: "Sarpas (Naga Sovereigns)", shakti: "Visasleshana (Intuitive Radar)", vibe: "Deep psychological perception; read beneath surface appearances and anticipate hidden moves." },
        "magha": { deity: "Pitris (Ancestral Lineage)", shakti: "Tyaga (Ancestral Authority)", vibe: "Regal presence and unwavering self-respect; stand tall in your heritage and executive dignity." },
        "purva phalguni": { deity: "Bhaga (Prosperity & Luck)", shakti: "Prajanana (Creative Alliance)", vibe: "Social magnetism and celebratory warmth; forge meaningful alliances and share creative joy." },
        "uttara phalguni": { deity: "Aryaman (Chivalry & Nobility)", shakti: "Chayani (Enduring Patronage)", vibe: "Steadfast loyalty and honor; formalize contracts with partners who share your moral integrity." },
        "hasta": { deity: "Savitur (Solar Awakener)", shakti: "Hasta (Precision Craftsmanship)", vibe: "Artisanal dexterity and swift calculation; impeccable day for writing, editing, and technical execution." },
        "chitra": { deity: "Tvashtar (Divine Architect)", shakti: "Punya (Aesthetic Synthesis)", vibe: "Brilliant visual elegance and inventive flair; craft visually stunning layouts and structural models." },
        "swati": { deity: "Vayu (Wind of Freedom)", shakti: "Pradhvamsa (Adaptive Independence)", vibe: "Supple, diplomatic flexibility; navigate unexpected shifts with graceful detachment and agility." },
        "vishakha": { deity: "Indragni (Fire & Lightning)", shakti: "Vyapana (Triumphant Goal-Focus)", vibe: "Relentless determination; laser focus on crossing the finish line on long-term targets." },
        "anuradha": { deity: "Mitra (Friendship & Harmony)", shakti: "Radhana (Unshakeable Devotion)", vibe: "Heart-centered organizational mastery; balance complex collective dynamics through authentic trust." },
        "jyeshtha": { deity: "Indra (King of Devas)", shakti: "Arohana (Protective Command)", vibe: "Courageous elder presence; assume control during ambiguity and safeguard team interests." },
        "mula": { deity: "Nirriti (Goddess of Origins)", shakti: "Barhana (Root Penetration)", vibe: "Radical deconstruction down to bedrock truth; pull out systemic flaws from the roots." },
        "purva ashadha": { deity: "Apas (Cosmic Waters)", shakti: "Varchograhana (Invincible Conviction)", vibe: "Unyielding self-belief and infectious persuasion; your enthusiasm rallies collective momentum." },
        "uttara ashadha": { deity: "Vishwadevas (Universal Cosmic Laws)", shakti: "Apradhrishya (Enduring Victory)", vibe: "Sustained dharmic triumph; patience and principled commitment ensure uncontested victory." },
        "shravana": { deity: "Vishnu (Cosmic Preserver)", shakti: "Shruti (Attuned Listening)", vibe: "Profound receptive intelligence; listen intently to unsaid nuances and absorb sacred knowledge." },
        "dhanishta": { deity: "Ashta Vasus (Elemental Gods of Wealth)", shakti: "Khyapayitri (Rhythmic Prosperity)", vibe: "Harmonious timing and magnetic resonance; align actions with natural cosmic cycles for maximum abundance." },
        "shatabhisha": { deity: "Varuna (Cosmic Ocean King)", shakti: "Bheshaja (Esoteric Healing)", vibe: "Deep meditative secrecy, futuristic tech vision, and profound holistic healing." },
        "purva bhadrapada": { deity: "Aja Ekapada (Fire Serpent)", shakti: "Yajamana (Ascetic Willpower)", vibe: "Uncompromising spiritual conviction; look directly into shadow dynamics to alchemize raw power." },
        "uttara bhadrapada": { deity: "Ahir Budhnya (Deep Abyss Serpent)", shakti: "Varshavardhana (Impenetrable Calm)", vibe: "Vast oceanic stillness and wisdom; withstand turbulent surroundings with serene equanimity." },
        "revati": { deity: "Pushan (Nurturer & Pathfinder)", shakti: "Kshiradyapana (Graceful Completion)", vibe: "Nurturing completion and safe passage; tie up loose threads with graceful generosity." }
    };

    const RASHI_GOCHAR_PALETTES = {
        0: { 1: "Deep Crimson & Solar Gold", 2: "Coral Red & Honey Amber", 3: "Fiery Scarlet & Copper", 4: "Ruby & Moonstone White", 5: "Bright Vermilion & Topaz", 6: "Bloodstone & Tempered Steel", 7: "Rose Coral & Champagne", 8: "Obsidian Garnet & Charcoal", 9: "Crimson & Radiant Saffron", 10: "Imperial Red & Regal Gold", 11: "Electric Scarlet & Cyber Cyan", 12: "Smoky Maroon & Twilight Silver" },
        1: { 1: "Forest Jade & Platinum White", 2: "Emerald & Golden Champagne", 3: "Malachite & Mint Green", 4: "Pale Celadon & Moonstone Pearl", 5: "Apple Jade & Warm Amber", 6: "Deep Pine & Smoky Quartz", 7: "Rose Quartz & Diamond White", 8: "Dark Moss & Onyx", 9: "Emerald & Saffron Gold", 10: "Royal Peacock & Platinum", 11: "Electric Aquamarine & Silver", 12: "Mystic Sage & Lavender Pearl" },
        2: { 1: "Cyber Mint & Electric Yellow", 2: "Golden Citrine & Pale Jade", 3: "Solar Amber & Bright Lime", 4: "Opal White & Seafoam Mint", 5: "Topaz Yellow & Neon Cyan", 6: "Olive Peridot & Slate", 7: "Pastel Cyan & Peach Pearl", 8: "Smoky Amber & Graphite", 9: "Goldenrod & Celestial Azure", 10: "Brilliant Mercury & Platinum", 11: "Electric Turquoise & Mint", 12: "Chiffon Silver & Pale Lavender" },
        3: { 1: "Sea Pearl & Moonstone Silver", 2: "Mother of Pearl & Golden Amber", 3: "Aquamarine & Soft Mint", 4: "Pure Opal & Celestial White", 5: "Golden Topaz & Dewdrop Silver", 6: "River Stone & Slate Grey", 7: "Rose Quartz & Liquid Pearl", 8: "Smoky Moonstone & Deep Abyss", 9: "Celestial Silver & Sacred Saffron", 10: "Imperial Platinum & Sapphire", 11: "Electric Seafoam & Silver", 12: "Translucent White & Mystic Violet" },
        4: { 1: "Imperial Ruby & Radiant Gold", 2: "Golden Citrine & Burnished Bronze", 3: "Solar Flare & Flame Orange", 4: "Sunstone & Pearl Cream", 5: "Brilliant Amber & Royal Gold", 6: "Tigers Eye & Tempered Bronze", 7: "Rose Gold & Honey Champagne", 8: "Dark Carnelian & Obsidian", 9: "Sacred Saffron & Royal Sunbeam", 10: "Regal Gold & Imperial Crimson", 11: "Solar Topaz & Electric Azure", 12: "Smoky Amber & Twilight Gold" },
        5: { 1: "Olive Jasper & Warm Champagne", 2: "Golden Wheat & Emerald Mint", 3: "Peridot Green & Amber Sand", 4: "Pale Celadon & Cream Pearl", 5: "Honey Topaz & Jade Green", 6: "Deep Forest Moss & Slate", 7: "Dusty Rose & Linen White", 8: "Smoky Quartz & Dark Earth", 9: "Saffron Ochre & Olive Gold", 10: "Imperial Emerald & Platinum", 11: "Turquoise Green & Champagne", 12: "Misty Sage & Soft Violet" },
        6: { 1: "Rose Quartz & Celestial Cyan", 2: "Champagne Opal & Golden Rose", 3: "Sky Blue & Pastel Coral", 4: "Alabaster White & Soft Pink", 5: "Iridescent Topaz & Peach", 6: "Smoky Sapphire & Dove Grey", 7: "Blush Rose & Diamond White", 8: "Velvet Plum & Dark Platinum", 9: "Saffron Rose & Azure Blue", 10: "Royal Cyan & Platinum Pearl", 11: "Electric Pastel & Mint", 12: "Mystic Lilac & Moonstone" },
        7: { 1: "Deep Garnet & Obsidian Onyx", 2: "Burnished Copper & Blood Orange", 3: "Crimson Steel & Iron Grey", 4: "Smoky Pearl & Wine Red", 5: "Fiery Topaz & Bloodstone", 6: "Charcoal Slate & Dark Scarlet", 7: "Rose Garnet & Antique Silver", 8: "Midnight Black & Void Crimson", 9: "Sacred Saffron & Blood Ruby", 10: "Imperial Burgundy & Black Gold", 11: "Electric Cobalt & Dark Scarlet", 12: "Twilight Purple & Obsidian Smoke" },
        8: { 1: "Saffron Topaz & Sacred Yellow", 2: "Golden Amber & Citrine Honey", 3: "Solar Flame & Bright Ochre", 4: "Moonstone Cream & Marigold", 5: "Brilliant Topaz & Sunbeam Gold", 6: "Tigers Eye & Khaki Slate", 7: "Rose Amber & Champagne Gold", 8: "Smoky Topaz & Deep Bronze", 9: "Pure Saffron & Royal Temple Gold", 10: "Regal Jupiter & Imperial Yellow", 11: "Electric Amber & Turquoise", 12: "Mystic Saffron & Twilight Violet" },
        9: { 1: "Charcoal Steel & Midnight Indigo", 2: "Burnished Bronze & Dark Amber", 3: "Graphite Iron & Electric Teal", 4: "Slate Pearl & Shadow Silver", 5: "Dark Sapphire & Bronze Gold", 6: "Hematite Stone & Deep Forest", 7: "Smoky Rose & Platinum Grey", 8: "Pitch Obsidian & Dark Lead", 9: "Antique Gold & Midnight Cobalt", 10: "Imperial Cobalt & Deep Platinum", 11: "Electric Azure & Dark Steel", 12: "Twilight Indigo & Charcoal Smoke" },
        10: { 1: "Electric Violet & Aqua Marine", 2: "Neon Cyan & Pale Gold", 3: "Cobalt Blue & Cyber Mint", 4: "Moonstone Mist & Electric Teal", 5: "Ultra Violet & Solar Amber", 6: "Slate Navy & Tempered Steel", 7: "Rose Cyan & Platinum White", 8: "Deep Cosmic Indigo & Obsidian", 9: "Electric Saffron & Sky Blue", 10: "Imperial Sapphire & Violet Pearl", 11: "Laser Turquoise & Pure Silver", 12: "Astral Purple & Starlight Mist" },
        11: { 1: "Seafoam Turquoise & Iridescent Gold", 2: "Aquamarine & Champagne Pearl", 3: "Ocean Mint & Golden Sand", 4: "Moonstone White & Pale Azure", 5: "Sunlit Water & Coral Gold", 6: "Deep Sea Navy & River Stone", 7: "Rose Quartz & Liquid Aquamarine", 8: "Abyssal Indigo & Dark Coral", 9: "Sacred Goldenrod & Marine Cyan", 10: "Imperial Ocean Pearl & Gold", 11: "Electric Sea Green & Platinum", 12: "Translucent Foam & Mystic Violet" }
    };

    function synthesizeRashiForecast(rashiId) {
        const rashi = RASHIS[rashiId];
        const displayEl = document.getElementById('rashi-forecast-output');
        if (!displayEl) return;

        // Pull active Panchang values from page DOM if available
        const amritEl = document.getElementById('astro-val-amrit') || document.querySelector('.astro-row.amrit .astro-value');
        const amritKaal = amritEl ? amritEl.textContent.trim() : '10:00 a.m. - 11:30 a.m.';
        const rahuEl = document.getElementById('astro-val-rahu') || document.querySelector('.astro-row.rahu .astro-value');
        const rahuKaal = rahuEl ? rahuEl.textContent.trim() : '1:30 p.m. - 3:00 p.m.';

        // Resolve active target date strictly from input or fallback to now
        const dateInput = document.getElementById('date-search');
        let targetDate = new Date();
        if (dateInput && dateInput.value) {
            const parsed = new Date(dateInput.value + 'T12:00:00');
            if (!isNaN(parsed.getTime())) {
                targetDate = parsed;
            }
        }

        // Always compute fresh astronomical coordinates specifically for targetDate!
        const pos = calculatePlanetaryPositions(targetDate);
        currentPlanetsData = pos;
        const moonDeg = pos.chandra;

        const jd = getJulianDay(targetDate);
        const d = jd - 2451545.0;
        const ayanamsa = 23.86 + (d / 365.25) * (50.29 / 3600.0);
        const siderealMoon = normalizeDeg(moonDeg - ayanamsa);
        const moonSignIdx = Math.floor(siderealMoon / 30) % 12;

        // Classical Vedic Chandra Gochar Bhava calculation (1 to 12)
        const houseNum = ((moonSignIdx - rashiId + 12) % 12) + 1;
        const bhava = BHAVAS_GOCHAR[houseNum] || BHAVAS_GOCHAR[1];

        // 27 Nakshatras list in sidereal order
        const NAKSHATRAS_ORDER = [
            "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashirsha", "Ardra",
            "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
            "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
            "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
            "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
        ];
        const computedNakIndex = Math.floor(siderealMoon / (360.0 / 27.0)) % 27;
        const computedNakshatra = NAKSHATRAS_ORDER[computedNakIndex];

        // Retrieve active Nakshatra (use DOM if it matches date or fallback to computed)
        const nakshatraEl = document.getElementById('astro-val-nakshatra');
        const nakshatra = (nakshatraEl && nakshatraEl.textContent.trim() && nakshatraEl.textContent.trim() !== '-')
            ? nakshatraEl.textContent.trim()
            : computedNakshatra;

        // Retrieve active Nakshatra metaphysical profile
        const nakClean = nakshatra.toLowerCase().trim().replace(/[^a-z ]/g, '');
        const nakData = NAKSHATRAS_METAPHYSICS[nakClean] || {
            deity: "Cosmic Architect",
            shakti: "Harmonic Alignment",
            vibe: "Active celestial resonance channeling cosmic focus into foundational execution."
        };

        // Element-specific interaction with today's Nakshatra
        let elementSynthesis = "";
        if (rashi.element === 'Fire') {
            elementSynthesis = `Directs catalytic, decisive willpower into bold execution. As a Fire sign ruled by ${rashi.lord}, channel this surge into high-impact building; avoid impatient confrontations.`;
        } else if (rashi.element === 'Earth') {
            elementSynthesis = `Anchors visionary thoughts into concrete structures, financial stability, and technical precision. Your Earth discipline grounded by ${rashi.lord} brings order to chaotic environments.`;
        } else if (rashi.element === 'Air') {
            elementSynthesis = `Accelerates intellectual synthesis, diplomatic dialogue, and network expansion. Your Air agility ruled by ${rashi.lord} is prime for publishing, negotiations, and technical strategy.`;
        } else {
            elementSynthesis = `Magnifies empathic radar and strategic foresight. Your Water intuition guided by ${rashi.lord} can read unsaid motivations; trust your gut in community decisions.`;
        }

        // House-specific timing recommendations for this exact Rashi
        let amritAdvice = "";
        let rahuAdvice = "";

        if ([1, 5, 9, 10].includes(houseNum)) {
            amritAdvice = `Peak Power Window for ${rashi.name}: Use ${amritKaal} to push forward key dispatches, initiate high-value proposals, and present deliverables to leadership.`;
            rahuAdvice = `Tactical Pause for ${rashi.name}: Step back from high-stakes decisions during ${rahuKaal}. Use this time to review drafts and organize your workspace.`;
        } else if ([2, 11].includes(houseNum)) {
            amritAdvice = `Prosperity Window for ${rashi.name}: Prime alignment at ${amritKaal} for financial audits, contract discussions, budget approvals, and realizing returns.`;
            rahuAdvice = `Financial Caution for ${rashi.name}: Strictly avoid unverified token transactions or impulsive purchases during ${rahuKaal}.`;
        } else if ([3, 6, 7].includes(houseNum)) {
            amritAdvice = `Action & Synergy Window for ${rashi.name}: Target ${amritKaal} for crucial partner alignment, clearing complex backlog tasks, and decisive outreach.`;
            rahuAdvice = `Friction Caution for ${rashi.name}: Guard against irritation or hasty arguments with colleagues between ${rahuKaal}.`;
        } else {
            // Houses 4, 8, 12 (Introspective & Restorative)
            amritAdvice = `Clarity & Healing Window for ${rashi.name}: Channel ${amritKaal} into deep architectural design, confidential strategy, or focused meditation.`;
            rahuAdvice = `High Vulnerability Window for ${rashi.name}: Defer irreversible commitments, contentious debates, or speculative risks between ${rahuKaal}.`;
        }

        // Dynamic Bespoke Color Harmonic & Vedic Resonance Numbers from Transit House & Date
        const rashiPalettes = RASHI_GOCHAR_PALETTES[rashiId] || RASHI_GOCHAR_PALETTES[0];
        const blendedColorHarmonic = rashiPalettes[houseNum] || "Deep Crimson & Solar Gold";
        const transitNum = houseNum <= 9 ? houseNum : ((houseNum - 1) % 9) + 1;
        const harmonicKey = ((targetDate.getDate() + (rashi.root || 9) * 2 + houseNum - 1) % 9) + 1;
        const resonanceNumbers = `${rashi.root || 9}, ${transitNum} (KEY: ${harmonicKey})`;

        displayEl.innerHTML = `
            <div class="row align-items-center mb-4">
                <div class="col-md-7">
                    <div class="d-flex align-items-center gap-3">
                        <span style="font-size:42px; line-height:1;">${rashi.symbol}</span>
                        <div>
                            <h3 style="font-family:var(--font-brand); font-size:var(--text-xl); font-weight:800; color:var(--text-primary); margin:0;">
                                ${rashi.name} <span style="font-size:var(--text-sm); font-family:var(--font-sans); font-weight:500; color:var(--text-muted);">(${rashi.en})</span>
                            </h3>
                            <div class="d-flex flex-wrap gap-2 mt-1">
                                <span style="font-family:var(--font-sans); font-size:var(--text-xs); font-weight:700; letter-spacing:1px; color:var(--accent-green);">
                                    ${rashi.element.toUpperCase()} ELEMENT · LORD: ${rashi.lord.toUpperCase()}
                                </span>
                                <span class="${bhava.badgeClass}" style="font-family:var(--font-sans); font-size:var(--text-xs); font-weight:700; letter-spacing:0.5px; border-radius:var(--radius-pill); padding:2px 10px;">
                                    ${bhava.tone}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-5 text-md-end mt-3 mt-md-0">
                    <span style="font-family:var(--font-sans); font-size:var(--text-xs); font-weight:700; letter-spacing:1px; color:var(--text-muted); display:block;">CHANDRA GOCHAR TRANSIT</span>
                    <span style="font-family:var(--font-brand); font-size:var(--text-md); font-weight:800; color:var(--accent-pink);">
                        HOUSE ${houseNum} · ${bhava.sanskrit.toUpperCase()}
                    </span>
                    <span style="font-family:var(--font-sans); font-size:var(--text-xs); color:var(--text-secondary); display:block;">
                        ${bhava.theme}
                    </span>
                </div>
            </div>

            <!-- PILLAR 1: TACTICAL & MATERIAL DIRECTIVE -->
            <div class="p-3 mb-3" style="background:var(--bg-elevated); border-left:3px solid var(--accent-green); border-radius:0 var(--radius-md) var(--radius-md) 0;">
                <h5 style="font-family:var(--font-sans); font-size:var(--text-xs); font-weight:800; letter-spacing:1.5px; color:var(--accent-green); margin-bottom:6px;">
                    💼 1. TACTICAL &amp; MATERIAL DIRECTIVE · ${bhava.name.toUpperCase()} (HOUSE ${houseNum})
                </h5>
                <p style="font-family:var(--font-sans); font-size:var(--text-sm); color:var(--text-primary); line-height:1.65; margin:0;">
                    ${bhava.action}
                </p>
            </div>

            <!-- PILLAR 2: COGNITIVE & ELEMENTAL HARMONIC -->
            <div class="p-3 mb-3" style="background:var(--bg-elevated); border-left:3px solid var(--accent-pink); border-radius:0 var(--radius-md) var(--radius-md) 0;">
                <h5 style="font-family:var(--font-sans); font-size:var(--text-xs); font-weight:800; letter-spacing:1.5px; color:var(--accent-pink); margin-bottom:6px;">
                    🧠 2. COGNITIVE &amp; ELEMENTAL HARMONIC · ${rashi.element.toUpperCase()} + ${nakshatra.toUpperCase()}
                </h5>
                <p style="font-family:var(--font-sans); font-size:var(--text-sm); color:var(--text-primary); line-height:1.65; margin:0;">
                    <b>Shakti (${nakData.shakti}):</b> ${elementSynthesis} <em>${nakData.vibe}</em>
                </p>
            </div>

            <!-- PILLAR 3: COSMIC TIMING GATEWAYS -->
            <div class="row">
                <div class="col-md-6 mb-3">
                    <div class="p-3 h-100" style="background:var(--bg-elevated); border:1px solid rgba(141,198,63,0.3); border-radius:var(--radius-md);">
                        <span style="font-family:var(--font-sans); font-size:var(--text-xs); font-weight:800; letter-spacing:1px; color:var(--accent-green); display:block; margin-bottom:4px;">
                            ✨ AMRIT KAAL FOR ${rashi.name.toUpperCase()} (${amritKaal})
                        </span>
                        <p style="font-family:var(--font-sans); font-size:var(--text-sm); color:var(--text-secondary); margin-top:6px; margin-bottom:0; line-height:1.5;">
                            ${amritAdvice}
                        </p>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="p-3 h-100" style="background:var(--bg-elevated); border:1px solid rgba(255,77,77,0.3); border-radius:var(--radius-md);">
                        <span style="font-family:var(--font-sans); font-size:var(--text-xs); font-weight:800; letter-spacing:1px; color:#e11d48; display:block; margin-bottom:4px;">
                            ⚠️ RAHU KAAL FOR ${rashi.name.toUpperCase()} (${rahuKaal})
                        </span>
                        <p style="font-family:var(--font-sans); font-size:var(--text-sm); color:var(--text-secondary); margin-top:6px; margin-bottom:0; line-height:1.5;">
                            ${rahuAdvice}
                        </p>
                    </div>
                </div>
            </div>

            <div class="d-flex flex-wrap justify-content-between align-items-center pt-3" style="border-top:1px solid var(--border-card); font-family:var(--font-sans); font-size:var(--text-xs); letter-spacing:0.5px; font-weight:600; color:var(--text-muted); gap:16px;">
                <div>DAILY COLOR HARMONIC: <strong style="color:var(--text-primary); font-weight:700;">${blendedColorHarmonic}</strong></div>
                <div>DAILY RESONANCE NUMBERS: <strong style="color:var(--accent-green); font-weight:700;">${resonanceNumbers}</strong></div>
                <div>LUNAR MANSION: <strong style="color:var(--accent-pink); font-weight:700;">${nakshatra} (${nakData.deity})</strong></div>
            </div>
        `;
    }

    // ── 5. ASYNCHRONOUS API SYNCHRONIZATION ──
    function fetchAndUpdateAthereal(dateStr) {
        const syncText = document.getElementById('astro-sync-text');
        if (syncText) {
            syncText.innerHTML = '<span class="spinner-border spinner-border-sm me-1" style="width:11px; height:11px;" role="status"></span> Syncing ephemeris...';
        }

        fetch('/api/athereal/?date=' + encodeURIComponent(dateStr))
            .then(res => {
                if (!res.ok) throw new Error('API response status ' + res.status);
                return res.json();
            })
            .then(json => {
                if (json.status === 'success' && json.data) {
                    const d = json.data;

                    const tithiHeader = document.getElementById('astro-tithi-header');
                    if (tithiHeader) tithiHeader.textContent = d.tithi_title || 'AAJ KI TITHI';

                    if (syncText) {
                        syncText.textContent = d.source || 'Automated Vedic Ephemeris';
                    }

                    const valDate = document.getElementById('astro-val-date');
                    if (valDate) valDate.textContent = d.date_formatted || d.date;

                    const valLoc = document.getElementById('astro-val-location');
                    if (valLoc) valLoc.textContent = d.location;

                    const valNak = document.getElementById('astro-val-nakshatra');
                    if (valNak) valNak.textContent = d.nakshatra || '-';

                    const valSr = document.getElementById('astro-val-sunrise');
                    if (valSr) valSr.textContent = d.sunrise || '-';

                    const valSs = document.getElementById('astro-val-sunset');
                    if (valSs) valSs.textContent = d.sunset || '-';

                    const valMr = document.getElementById('astro-val-moonrise');
                    if (valMr) valMr.textContent = d.moonrise || '-';

                    const valMs = document.getElementById('astro-val-moonset');
                    if (valMs) valMs.textContent = d.moonset || '-';

                    const valAmrit = document.getElementById('astro-val-amrit');
                    if (valAmrit) valAmrit.textContent = d.amrit_kaal || '-';

                    const valRahu = document.getElementById('astro-val-rahu');
                    if (valRahu) valRahu.textContent = d.rahu_kaal || '-';

                    const valAbhijit = document.getElementById('astro-val-abhijit');
                    if (valAbhijit) valAbhijit.textContent = d.abhijit || '-';

                    const insightBox = document.getElementById('astro-insight-box');
                    const valInsight = document.getElementById('astro-val-insight');
                    if (valInsight && d.cosmic_insight) {
                        valInsight.innerHTML = d.cosmic_insight.replace(/\n/g, '<br>');
                        if (insightBox) {
                            insightBox.classList.remove('d-none');
                            insightBox.style.display = 'block';
                        }
                    }

                    // Recalculate and render wheel
                    const targetDate = new Date(dateStr + 'T12:00:00');
                    const positions = calculatePlanetaryPositions(targetDate);
                    renderWheel(positions);

                    // Re-synthesize active Rashi with new Nakshatra & Amrit/Rahu Kaal
                    const activeRashi = document.querySelector('.rashi-select-pill.active');
                    const rId = activeRashi ? parseInt(activeRashi.getAttribute('data-rashi-id'), 10) : 0;
                    synthesizeRashiForecast(rId);

                    // Re-select active planet if one is chosen
                    const activePlanetBtn = document.querySelector('.planet-pill-btn.active');
                    if (activePlanetBtn) {
                        selectPlanet(activePlanetBtn.getAttribute('data-planet'));
                    }
                }
            })
            .catch(err => {
                console.warn('Live API sync failed, falling back to client-side engine:', err);
                if (syncText) syncText.textContent = 'Offline Vedic Ephemeris';
                const targetDate = new Date(dateStr + 'T12:00:00');
                const positions = calculatePlanetaryPositions(targetDate);
                renderWheel(positions);
                const activeRashi = document.querySelector('.rashi-select-pill.active');
                const rId = activeRashi ? parseInt(activeRashi.getAttribute('data-rashi-id'), 10) : 0;
                synthesizeRashiForecast(rId);
            });
    }

    // Expose fetchAndUpdateAthereal globally
    window.fetchAndUpdateAthereal = fetchAndUpdateAthereal;

    // ── 6. INITIALIZATION ──
    function initAthereal() {
        const dateInput = document.getElementById('date-search');
        const searchForm = document.querySelector('form.search-card');

        let selectedDate = new Date();
        if (dateInput && dateInput.value) {
            const parsed = new Date(dateInput.value);
            if (!isNaN(parsed)) selectedDate = parsed;
        }

        // Calculate and render wheel initial state
        const positions = calculatePlanetaryPositions(selectedDate);
        renderWheel(positions);

        // Wire Planet Selection Pills
        document.querySelectorAll('.planet-pill-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const planetKey = this.getAttribute('data-planet');
                selectPlanet(planetKey);
            });
        });

        // Wire Rashi Selection Pills
        const rashiBtns = document.querySelectorAll('.rashi-select-pill');
        rashiBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                rashiBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                const rashiId = parseInt(this.getAttribute('data-rashi-id'), 10);
                synthesizeRashiForecast(rashiId);
            });
        });

        // Default to Mesha (0)
        synthesizeRashiForecast(0);

        // Live update when celestial date picker changes
        if (dateInput) {
            dateInput.addEventListener('change', function() {
                if (this.value) {
                    fetchAndUpdateAthereal(this.value);
                    if (window.history && window.history.pushState) {
                        window.history.pushState({}, '', '/athereal/?date=' + this.value);
                    }
                }
            });
        }

        // Quick "TODAY" alignment shortcut button
        const resetTodayBtn = document.getElementById('btn-reset-today');
        if (resetTodayBtn) {
            resetTodayBtn.addEventListener('click', function() {
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                const todayStr = `${y}-${m}-${d}`;
                if (dateInput) {
                    dateInput.value = todayStr;
                }
                fetchAndUpdateAthereal(todayStr);
                if (window.history && window.history.pushState) {
                    window.history.pushState({}, '', '/athereal/');
                }
            });
        }

        // Live update on theme toggle (Light / Dark)
        window.addEventListener('kspeaksThemeChanged', function() {
            renderWheel(currentPlanetsData);
            const activeRashi = document.querySelector('.rashi-select-pill.active');
            const rId = activeRashi ? parseInt(activeRashi.getAttribute('data-rashi-id'), 10) : 0;
            synthesizeRashiForecast(rId);
            if (currentKundaliData) renderKundaliChart();
        });

        // ══════════════════════════════════════════════════════════════
        // ── SECTION 3: PERSONALIZED BIRTH CHART (KUNDALI) ENGINE ──────
        // ══════════════════════════════════════════════════════════════
        let currentKundaliData = null;
        let currentKundaliStyle = 'north';

        const kForm = document.getElementById('kundali-calc-form');
        const kDateInput = document.getElementById('k-date');
        const kTimeInput = document.getElementById('k-time');
        const kCitySelect = document.getElementById('k-city');
        const kContainer = document.getElementById('kundali-output-container');
        const kLagnaBadge = document.getElementById('k-lagna-badge');
        const kNakshatraBadge = document.getElementById('k-nakshatra-badge');
        const kSvgWrap = document.getElementById('kundali-svg-wrap');
        const kTableBody = document.getElementById('kundali-planets-tbody');
        const kBtnNorth = document.getElementById('k-btn-north');
        const kBtnSouth = document.getElementById('k-btn-south');
        const kDownloadBtn = document.getElementById('k-download-btn');

        if (kDateInput && !kDateInput.value) {
            kDateInput.value = new Date().toISOString().split('T')[0];
        }

        async function fetchKundaliData() {
            if (!kDateInput || !kTimeInput || !kCitySelect) return;
            const dateVal = kDateInput.value;
            const timeVal = kTimeInput.value || '12:00';
            const [lat, lon, tz] = kCitySelect.value.split(',');

            if (!dateVal) return;
            const [year, month, day] = dateVal.split('-');
            const [hour, minute] = timeVal.split(':');

            if (kSvgWrap) {
                kSvgWrap.innerHTML = '<div class="p-4 text-muted"><i class="bi bi-arrow-repeat spin"></i> Calculating Sidereal Ephemeris...</div>';
            }
            if (kContainer) kContainer.style.display = 'block';

            try {
                const url = `/api/kundali/?year=${year}&month=${month}&day=${day}&hour=${hour}&minute=${minute}&lat=${lat}&lon=${lon}&tz=${tz}`;
                const res = await fetch(url);
                const result = await res.json();

                if (result && result.success) {
                    currentKundaliData = result;
                    updateKundaliBadges(result);
                    renderKundaliChart();
                    renderKundaliTable(result);
                } else {
                    if (kSvgWrap) kSvgWrap.innerHTML = '<div class="p-3 text-danger">Error calculating chart.</div>';
                }
            } catch (err) {
                console.error("Kundali API error:", err);
                if (kSvgWrap) kSvgWrap.innerHTML = '<div class="p-3 text-danger">Failed to fetch Kundali data.</div>';
            }
        }

        function updateKundaliBadges(data) {
            if (kLagnaBadge && data.lagna) {
                kLagnaBadge.innerHTML = `Lagna: <b>${data.lagna.sign_sanskrit} (${data.lagna.sign_english})</b> ${data.lagna.degree_in_sign}°`;
            }
            if (kNakshatraBadge && data.lagna) {
                kNakshatraBadge.innerHTML = `Nakshatra: <b>${data.lagna.nakshatra}</b> (Pada ${data.lagna.pada})`;
            }
        }

        function renderKundaliTable(data) {
            if (!kTableBody || !data.planets) return;
            let rows = '';
            data.planets.forEach(p => {
                const retro = p.is_retrograde ? ' <span class="badge bg-warning text-dark" style="font-size:9px;">[R]</span>' : '';
                rows += `
                    <tr>
                        <td><b>${p.name}</b> (${p.sanskrit})${retro}</td>
                        <td>${p.sign_symbol} ${p.sign_sanskrit}</td>
                        <td>${p.degree_in_sign}°</td>
                        <td>${p.nakshatra} (${p.pada})</td>
                        <td><span class="badge" style="background:rgba(193,255,114,0.12); color:var(--accent-green); font-size:11px;">H${p.house}</span></td>
                    </tr>
                `;
            });
            kTableBody.innerHTML = rows;
        }

        function renderKundaliChart() {
            if (!currentKundaliData || !kSvgWrap) return;
            if (currentKundaliStyle === 'north') {
                kSvgWrap.innerHTML = generateNorthIndianSVG(currentKundaliData);
            } else {
                kSvgWrap.innerHTML = generateSouthIndianSVG(currentKundaliData);
            }
        }

        function generateNorthIndianSVG(data) {
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';
            const strokeColor = isLight ? '#be185d' : '#C1FF72';
            const innerLineColor = isLight ? 'rgba(190, 24, 93, 0.45)' : 'rgba(193, 255, 114, 0.45)';
            const bgColor = isLight ? '#ffffff' : '#040e2a';
            const numColor = isLight ? '#be185d' : '#ee3ec9';
            const planetColor = isLight ? '#0f766e' : '#C1FF72';

            const houses = data.houses || {};

            function getPText(hNum) {
                const h = houses[hNum];
                if (!h || !h.planets || !h.planets.length) return '';
                return h.planets.map(p => p.code + (p.is_retrograde ? '®' : '')).join(' ');
            }

            function getSignNum(hNum) {
                const h = houses[hNum];
                return h ? h.sign_number : hNum;
            }

            return `
            <svg id="kundali-svg-element" viewBox="0 0 360 360" width="340" height="340" xmlns="http://www.w3.org/2000/svg" style="max-width:100%; height:auto;">
                <!-- Background -->
                <rect x="10" y="10" width="340" height="340" fill="${bgColor}" stroke="${strokeColor}" stroke-width="2.5" rx="10"/>

                <!-- Diagonals -->
                <line x1="10" y1="10" x2="350" y2="350" stroke="${innerLineColor}" stroke-width="1.8"/>
                <line x1="350" y1="10" x2="10" y2="350" stroke="${innerLineColor}" stroke-width="1.8"/>

                <!-- Central Diamond -->
                <polygon points="180,10 350,180 180,350 10,180" fill="none" stroke="${innerLineColor}" stroke-width="1.8"/>

                <!-- House 1 (Lagna - Top Diamond) -->
                <text x="180" y="72" fill="${numColor}" font-family="var(--font-heading)" font-size="12" font-weight="900" text-anchor="middle">${getSignNum(1)}</text>
                <text x="180" y="118" fill="${planetColor}" font-family="var(--font-sans)" font-size="13" font-weight="800" text-anchor="middle">${getPText(1)}</text>

                <!-- House 2 (Top Left Triangle) -->
                <text x="100" y="48" fill="${numColor}" font-family="var(--font-heading)" font-size="11" font-weight="900" text-anchor="middle">${getSignNum(2)}</text>
                <text x="95" y="80" fill="${planetColor}" font-family="var(--font-sans)" font-size="12" font-weight="800" text-anchor="middle">${getPText(2)}</text>

                <!-- House 3 (Left Top Triangle) -->
                <text x="48" y="102" fill="${numColor}" font-family="var(--font-heading)" font-size="11" font-weight="900" text-anchor="middle">${getSignNum(3)}</text>
                <text x="72" y="98" fill="${planetColor}" font-family="var(--font-sans)" font-size="12" font-weight="800" text-anchor="middle">${getPText(3)}</text>

                <!-- House 4 (Left Diamond) -->
                <text x="75" y="184" fill="${numColor}" font-family="var(--font-heading)" font-size="12" font-weight="900" text-anchor="middle">${getSignNum(4)}</text>
                <text x="118" y="184" fill="${planetColor}" font-family="var(--font-sans)" font-size="13" font-weight="800" text-anchor="middle">${getPText(4)}</text>

                <!-- House 5 (Left Bottom Triangle) -->
                <text x="48" y="262" fill="${numColor}" font-family="var(--font-heading)" font-size="11" font-weight="900" text-anchor="middle">${getSignNum(5)}</text>
                <text x="72" y="266" fill="${planetColor}" font-family="var(--font-sans)" font-size="12" font-weight="800" text-anchor="middle">${getPText(5)}</text>

                <!-- House 6 (Bottom Left Triangle) -->
                <text x="100" y="318" fill="${numColor}" font-family="var(--font-heading)" font-size="11" font-weight="900" text-anchor="middle">${getSignNum(6)}</text>
                <text x="95" y="286" fill="${planetColor}" font-family="var(--font-sans)" font-size="12" font-weight="800" text-anchor="middle">${getPText(6)}</text>

                <!-- House 7 (Bottom Diamond) -->
                <text x="180" y="292" fill="${numColor}" font-family="var(--font-heading)" font-size="12" font-weight="900" text-anchor="middle">${getSignNum(7)}</text>
                <text x="180" y="246" fill="${planetColor}" font-family="var(--font-sans)" font-size="13" font-weight="800" text-anchor="middle">${getPText(7)}</text>

                <!-- House 8 (Bottom Right Triangle) -->
                <text x="260" y="318" fill="${numColor}" font-family="var(--font-heading)" font-size="11" font-weight="900" text-anchor="middle">${getSignNum(8)}</text>
                <text x="265" y="286" fill="${planetColor}" font-family="var(--font-sans)" font-size="12" font-weight="800" text-anchor="middle">${getPText(8)}</text>

                <!-- House 9 (Right Bottom Triangle) -->
                <text x="312" y="262" fill="${numColor}" font-family="var(--font-heading)" font-size="11" font-weight="900" text-anchor="middle">${getSignNum(9)}</text>
                <text x="288" y="266" fill="${planetColor}" font-family="var(--font-sans)" font-size="12" font-weight="800" text-anchor="middle">${getPText(9)}</text>

                <!-- House 10 (Right Diamond) -->
                <text x="285" y="184" fill="${numColor}" font-family="var(--font-heading)" font-size="12" font-weight="900" text-anchor="middle">${getSignNum(10)}</text>
                <text x="242" y="184" fill="${planetColor}" font-family="var(--font-sans)" font-size="13" font-weight="800" text-anchor="middle">${getPText(10)}</text>

                <!-- House 11 (Right Top Triangle) -->
                <text x="312" y="102" fill="${numColor}" font-family="var(--font-heading)" font-size="11" font-weight="900" text-anchor="middle">${getSignNum(11)}</text>
                <text x="288" y="98" fill="${planetColor}" font-family="var(--font-sans)" font-size="12" font-weight="800" text-anchor="middle">${getPText(11)}</text>

                <!-- House 12 (Top Right Triangle) -->
                <text x="260" y="48" fill="${numColor}" font-family="var(--font-heading)" font-size="11" font-weight="900" text-anchor="middle">${getSignNum(12)}</text>
                <text x="265" y="80" fill="${planetColor}" font-family="var(--font-sans)" font-size="12" font-weight="800" text-anchor="middle">${getPText(12)}</text>
            </svg>
            `;
        }

        function generateSouthIndianSVG(data) {
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';
            const strokeColor = isLight ? '#be185d' : '#C1FF72';
            const innerLineColor = isLight ? 'rgba(190, 24, 93, 0.4)' : 'rgba(193, 255, 114, 0.4)';
            const bgColor = isLight ? '#ffffff' : '#040e2a';
            const textColor = isLight ? '#0f172a' : '#ffffff';
            const planetColor = isLight ? '#0f766e' : '#C1FF72';

            const signBoxes = [
                { sign: 12, name: 'Pisces', col: 0, row: 0 },
                { sign: 1,  name: 'Aries', col: 1, row: 0 },
                { sign: 2,  name: 'Taurus', col: 2, row: 0 },
                { sign: 3,  name: 'Gemini', col: 3, row: 0 },
                { sign: 4,  name: 'Cancer', col: 3, row: 1 },
                { sign: 5,  name: 'Leo', col: 3, row: 2 },
                { sign: 6,  name: 'Virgo', col: 3, row: 3 },
                { sign: 7,  name: 'Libra', col: 2, row: 3 },
                { sign: 8,  name: 'Scorpio', col: 1, row: 3 },
                { sign: 9,  name: 'Sagittarius', col: 0, row: 3 },
                { sign: 10, name: 'Capricorn', col: 0, row: 2 },
                { sign: 11, name: 'Aquarius', col: 0, row: 1 },
            ];

            const lagnaSignNum = data.lagna ? data.lagna.sign_number : 1;

            let boxesSvg = '';
            signBoxes.forEach(b => {
                const bx = 10 + b.col * 85;
                const by = 10 + b.row * 85;
                const isLagna = b.sign === lagnaSignNum;

                // Find planets in this sign
                const pInSign = (data.planets || []).filter(p => p.sign_number === b.sign);
                const pStr = pInSign.map(p => p.code + (p.is_retrograde ? '®' : '')).join(' ');

                boxesSvg += `
                    <rect x="${bx}" y="${by}" width="85" height="85" fill="${bgColor}" stroke="${innerLineColor}" stroke-width="1.2"/>
                    <text x="${bx + 6}" y="${by + 16}" fill="${textColor}" opacity="0.6" font-family="var(--font-sans)" font-size="10" font-weight="700">${b.name.substring(0,3).toUpperCase()}</text>
                    ${isLagna ? `<text x="${bx + 80}" y="${by + 16}" fill="#ee3ec9" font-family="var(--font-sans)" font-size="9" font-weight="900" text-anchor="end">ASC</text>` : ''}
                    <text x="${bx + 42}" y="${by + 52}" fill="${planetColor}" font-family="var(--font-sans)" font-size="12" font-weight="800" text-anchor="middle">${pStr}</text>
                `;
            });

            return `
            <svg id="kundali-svg-element" viewBox="0 0 360 360" width="340" height="340" xmlns="http://www.w3.org/2000/svg" style="max-width:100%; height:auto;">
                <!-- Outer Border -->
                <rect x="10" y="10" width="340" height="340" fill="${bgColor}" stroke="${strokeColor}" stroke-width="2.5" rx="8"/>
                <!-- 12 Boxes -->
                ${boxesSvg}
                <!-- Center Inscription -->
                <rect x="95" y="95" width="170" height="170" fill="${bgColor}" stroke="${innerLineColor}" stroke-width="1.5"/>
                <text x="180" y="165" fill="${strokeColor}" font-family="var(--font-heading)" font-size="13" font-weight="900" text-anchor="middle">VEDIC KUNDALI</text>
                <text x="180" y="185" fill="${textColor}" opacity="0.75" font-family="var(--font-sans)" font-size="10.5" font-weight="700" text-anchor="middle">NIRAYANA LAHIRI</text>
                <text x="180" y="205" fill="#ee3ec9" font-family="var(--font-sans)" font-size="10" font-weight="700" text-anchor="middle">LAGNA: H${data.lagna ? data.lagna.sign_number : 1}</text>
            </svg>
            `;
        }

        if (kBtnNorth && kBtnSouth) {
            kBtnNorth.addEventListener('click', () => {
                currentKundaliStyle = 'north';
                kBtnNorth.classList.add('active');
                kBtnSouth.classList.remove('active');
                kBtnNorth.style.borderColor = 'var(--accent-green)';
                kBtnNorth.style.color = 'var(--accent-green)';
                kBtnSouth.style.borderColor = 'var(--border-card)';
                kBtnSouth.style.color = 'var(--text-secondary)';
                renderKundaliChart();
            });

            kBtnSouth.addEventListener('click', () => {
                currentKundaliStyle = 'south';
                kBtnSouth.classList.add('active');
                kBtnNorth.classList.remove('active');
                kBtnSouth.style.borderColor = 'var(--accent-green)';
                kBtnSouth.style.color = 'var(--accent-green)';
                kBtnNorth.style.borderColor = 'var(--border-card)';
                kBtnNorth.style.color = 'var(--text-secondary)';
                renderKundaliChart();
            });
        }

        if (kDownloadBtn) {
            kDownloadBtn.addEventListener('click', () => {
                const svgElem = document.getElementById('kundali-svg-element');
                if (!svgElem) return;
                const serializer = new XMLSerializer();
                const source = '<?xml version="1.0" standalone="no"?>\r\n' + serializer.serializeToString(svgElem);
                const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `kspeaks-kundali-${kDateInput ? kDateInput.value : 'chart'}.svg`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        }

        if (kForm) {
            kForm.addEventListener('submit', (e) => {
                e.preventDefault();
                fetchKundaliData();
            });
        }

        // Auto calculate on load with initial default date
        fetchKundaliData();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAthereal);
    } else {
        initAthereal();
    }
})();
