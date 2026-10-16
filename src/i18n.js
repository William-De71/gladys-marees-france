// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, text states, widget contents, scene
// summaries, messages of the Configuration screen. Vocabulary of the Gladys
// interface (appareil / Gerät / dispositivo, scène / Szene / escena) and of
// the sea: pleine mer / basse mer, Hochwasser / Niedrigwasser, pleamar /
// bajamar, coefficient de marée / Koeffizient / coeficiente.
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // devices
  deviceName: { en: 'Tide {port}', fr: 'Marée {port}', de: 'Gezeiten {port}', es: 'Marea {port}' },
  featureHeight: {
    en: 'Water height',
    fr: 'Hauteur d’eau',
    de: 'Wasserhöhe',
    es: 'Altura del agua',
  },
  featureTrend: { en: 'Tide', fr: 'Marée', de: 'Gezeit', es: 'Marea' },
  featureNextTide: {
    en: 'Next tide',
    fr: 'Prochaine marée',
    de: 'Nächste Gezeit',
    es: 'Próxima marea',
  },
  featureNextHighIn: {
    en: 'High tide in',
    fr: 'Pleine mer dans',
    de: 'Hochwasser in',
    es: 'Pleamar en',
  },
  featureNextHighHeight: {
    en: 'Next high tide height',
    fr: 'Hauteur de la prochaine pleine mer',
    de: 'Höhe des nächsten Hochwassers',
    es: 'Altura de la próxima pleamar',
  },
  featureNextLowIn: {
    en: 'Low tide in',
    fr: 'Basse mer dans',
    de: 'Niedrigwasser in',
    es: 'Bajamar en',
  },
  featureNextLowHeight: {
    en: 'Next low tide height',
    fr: 'Hauteur de la prochaine basse mer',
    de: 'Höhe des nächsten Niedrigwassers',
    es: 'Altura de la próxima bajamar',
  },
  featureCoefficient: {
    en: 'Tide coefficient',
    fr: 'Coefficient de marée',
    de: 'Gezeitenkoeffizient',
    es: 'Coeficiente de marea',
  },
  featureCoefficientTomorrow: {
    en: 'Highest coefficient tomorrow',
    fr: 'Coefficient maximal demain',
    de: 'Höchster Koeffizient morgen',
    es: 'Coeficiente máximo mañana',
  },
  trend_rising: { en: 'Rising', fr: 'Montante', de: 'Steigend', es: 'Subiendo' },
  trend_falling: { en: 'Falling', fr: 'Descendante', de: 'Fallend', es: 'Bajando' },
  highTideAt: {
    en: 'High tide at {time} ({height} m)',
    fr: 'Pleine mer à {time} ({height} m)',
    de: 'Hochwasser um {time} ({height} m)',
    es: 'Pleamar a las {time} ({height} m)',
  },
  highTideAtCoef: {
    en: 'High tide at {time} ({height} m, coef. {coefficient})',
    fr: 'Pleine mer à {time} ({height} m, coef. {coefficient})',
    de: 'Hochwasser um {time} ({height} m, Koeff. {coefficient})',
    es: 'Pleamar a las {time} ({height} m, coef. {coefficient})',
  },
  lowTideAt: {
    en: 'Low tide at {time} ({height} m)',
    fr: 'Basse mer à {time} ({height} m)',
    de: 'Niedrigwasser um {time} ({height} m)',
    es: 'Bajamar a las {time} ({height} m)',
  },

  // scene summaries
  summaryTideNow: {
    en: '{port}: {tide}',
    fr: '{port} : {tide}',
    de: '{port}: {tide}',
    es: '{port}: {tide}',
  },
  summaryTideSoon: {
    en: '{port}: in {n} min, {tide}',
    fr: '{port} : dans {n} min, {tide}',
    de: '{port}: in {n} Min., {tide}',
    es: '{port}: en {n} min, {tide}',
  },
  summarySpring: {
    en: '{port}: spring tide, coefficient {coefficient}, high tide at {time}, low tide at {low}',
    fr: '{port} : grande marée, coefficient {coefficient}, pleine mer à {time}, basse mer à {low}',
    de: '{port}: Springtide, Koeffizient {coefficient}, Hochwasser um {time}, Niedrigwasser um {low}',
    es: '{port}: marea viva, coeficiente {coefficient}, pleamar a las {time}, bajamar a las {low}',
  },
  summaryNext: {
    en: '{port}: {tide}. Water height now {height} m, {trend}.',
    fr: '{port} : {tide}. Hauteur d’eau actuelle {height} m, marée {trend}.',
    de: '{port}: {tide}. Wasserhöhe jetzt {height} m, {trend}.',
    es: '{port}: {tide}. Altura del agua ahora {height} m, {trend}.',
  },

  // widgets
  caption: {
    en: 'SHOM · heights above chart datum',
    fr: 'SHOM · hauteurs au-dessus du zéro des cartes',
    de: 'SHOM · Höhen über Seekartennull',
    es: 'SHOM · alturas sobre el cero hidrográfico',
  },
  tileHeight: { en: 'Water height', fr: 'Hauteur d’eau', de: 'Wasserhöhe', es: 'Altura del agua' },
  tileTrend: { en: 'Tide', fr: 'Marée', de: 'Gezeit', es: 'Marea' },
  trendShort_rising: { en: 'Rising', fr: 'Montante', de: 'Steigend', es: 'Subiendo' },
  trendShort_falling: { en: 'Falling', fr: 'Descendante', de: 'Fallend', es: 'Bajando' },
  tileNext_high: { en: 'Next high tide', fr: 'Pleine mer', de: 'Hochwasser', es: 'Pleamar' },
  tileNext_low: { en: 'Next low tide', fr: 'Basse mer', de: 'Niedrigwasser', es: 'Bajamar' },
  tileCoefficient: { en: 'Coefficient', fr: 'Coefficient', de: 'Koeffizient', es: 'Coeficiente' },
  seriesHeight: {
    en: 'Water height',
    fr: 'Hauteur d’eau',
    de: 'Wasserhöhe',
    es: 'Altura del agua',
  },
  mark_high: { en: 'HW {time}', fr: 'PM {time}', de: 'HW {time}', es: 'PM {time}' },
  mark_low: { en: 'LW {time}', fr: 'BM {time}', de: 'NW {time}', es: 'BM {time}' },
  card_high: {
    en: 'High tide · {height} m',
    fr: 'Pleine mer · {height} m',
    de: 'Hochwasser · {height} m',
    es: 'Pleamar · {height} m',
  },
  card_low: {
    en: 'Low tide · {height} m',
    fr: 'Basse mer · {height} m',
    de: 'Niedrigwasser · {height} m',
    es: 'Bajamar · {height} m',
  },
  badgeCoefficient: { en: 'Coef. {n}', fr: 'Coef. {n}', de: 'Koeff. {n}', es: 'Coef. {n}' },
  tileToday: { en: 'Today', fr: 'Aujourd’hui', de: 'Heute', es: 'Hoy' },
  tilePeak: { en: 'Peak {date}', fr: 'Pic {date}', de: 'Spitze {date}', es: 'Máx. {date}' },
  tileSpring: { en: 'Next ≥ {n}', fr: 'Prochain ≥ {n}', de: 'Nächster ≥ {n}', es: 'Próximo ≥ {n}' },
  none: { en: 'None', fr: 'Aucun', de: 'Keiner', es: 'Ninguno' },
  seriesCoefficient: { en: 'Coefficient', fr: 'Coefficient', de: 'Koeffizient', es: 'Coeficiente' },
  noData: {
    en: 'No tide known for the coming days: see the connection status of the integration.',
    fr: 'Aucune marée connue pour les jours à venir : voir l’état de connexion de l’intégration.',
    de: 'Keine Gezeiten für die nächsten Tage bekannt: siehe Verbindungsstatus der Integration.',
    es: 'No se conoce ninguna marea para los próximos días: vea el estado de conexión de la integración.',
  },
  noCoefficients: {
    en: 'The SHOM publishes no coefficient for this harbor.',
    fr: 'Le SHOM ne publie pas de coefficient pour ce port.',
    de: 'Der SHOM veröffentlicht für diesen Hafen keinen Koeffizienten.',
    es: 'El SHOM no publica coeficientes para este puerto.',
  },
  noPort: {
    en: 'No harbor configured: choose one on the configuration page of the integration.',
    fr: 'Aucun port configuré : choisissez-en un dans la page de configuration de l’intégration.',
    de: 'Kein Hafen konfiguriert: Wählen Sie einen auf der Konfigurationsseite der Integration.',
    es: 'Ningún puerto configurado: elija uno en la página de configuración de la integración.',
  },
  notLoaded: {
    en: 'The tides of {port} are being downloaded from the SHOM.',
    fr: 'Les marées de {port} sont en cours de téléchargement depuis le SHOM.',
    de: 'Die Gezeiten von {port} werden vom SHOM heruntergeladen.',
    es: 'Las mareas de {port} se están descargando del SHOM.',
  },

  // connection status
  statusNoPort: {
    en: 'No harbor configured: pick one in the list, or type its name.',
    fr: 'Aucun port configuré : choisissez-en un dans la liste ou tapez son nom.',
    de: 'Kein Hafen konfiguriert: Wählen Sie einen aus der Liste oder geben Sie seinen Namen ein.',
    es: 'Ningún puerto configurado: elija uno de la lista o escriba su nombre.',
  },
  statusUnresolved: {
    en: 'Harbor not found: {entries}. Use the "Find a harbor" button.',
    fr: 'Port introuvable : {entries}. Utilisez le bouton « Rechercher un port ».',
    de: 'Hafen nicht gefunden: {entries}. Nutzen Sie die Schaltfläche „Hafen suchen“.',
    es: 'Puerto no encontrado: {entries}. Use el botón «Buscar un puerto».',
  },
  statusOk: {
    en: 'Tides of {ports} up to date.',
    fr: 'Marées de {ports} à jour.',
    de: 'Gezeiten von {ports} aktuell.',
    es: 'Mareas de {ports} al día.',
  },
  noteUnresolved: {
    en: 'Not found: {entries}.',
    fr: 'Introuvable : {entries}.',
    de: 'Nicht gefunden: {entries}.',
    es: 'No encontrado: {entries}.',
  },
  noteDropped: {
    en: 'Ignored (5 harbors at most): {dropped}.',
    fr: 'Ignoré (5 ports au plus) : {dropped}.',
    de: 'Ignoriert (höchstens 5 Häfen): {dropped}.',
    es: 'Ignorado (5 puertos como máximo): {dropped}.',
  },
  noteStale: {
    en: 'Download of today failed for {ports}: the data of the previous days is used.',
    fr: 'Téléchargement du jour en échec pour {ports} : les données des jours précédents sont utilisées.',
    de: 'Heutiger Download für {ports} fehlgeschlagen: die Daten der Vortage werden genutzt.',
    es: 'La descarga de hoy falló para {ports}: se usan los datos de los días anteriores.',
  },
  statusError_blocked: {
    en: 'The SHOM refused the requests for now. New try in a few hours.',
    fr: 'Le SHOM refuse les requêtes pour le moment. Nouvel essai dans quelques heures.',
    de: 'Der SHOM lehnt die Anfragen vorerst ab. Neuer Versuch in einigen Stunden.',
    es: 'El SHOM rechaza las solicitudes por ahora. Nuevo intento en unas horas.',
  },
  statusError_unknown_port: {
    en: 'The SHOM does not know this harbor any more: pick another one.',
    fr: 'Le SHOM ne connaît plus ce port : choisissez-en un autre.',
    de: 'Der SHOM kennt diesen Hafen nicht mehr: Wählen Sie einen anderen.',
    es: 'El SHOM ya no conoce este puerto: elija otro.',
  },
  statusError_http: {
    en: 'The SHOM service answered with an error. New try in a moment.',
    fr: 'Le service du SHOM a répondu par une erreur. Nouvel essai dans un moment.',
    de: 'Der SHOM-Dienst hat mit einem Fehler geantwortet. Neuer Versuch in Kürze.',
    es: 'El servicio del SHOM respondió con un error. Nuevo intento en un momento.',
  },
  statusError_invalid: {
    en: 'The SHOM answer could not be read. New try in a moment.',
    fr: 'La réponse du SHOM est illisible. Nouvel essai dans un moment.',
    de: 'Die Antwort des SHOM ist nicht lesbar. Neuer Versuch in Kürze.',
    es: 'La respuesta del SHOM no se pudo leer. Nuevo intento en un momento.',
  },
  statusError_unreachable: {
    en: 'The SHOM service cannot be reached: check the internet access of Gladys.',
    fr: 'Le service du SHOM est injoignable : vérifiez l’accès à Internet de Gladys.',
    de: 'Der SHOM-Dienst ist nicht erreichbar: Prüfen Sie den Internetzugang von Gladys.',
    es: 'No se puede acceder al servicio del SHOM: compruebe el acceso a Internet de Gladys.',
  },
  statusError_pending: {
    en: 'Downloading the tides from the SHOM…',
    fr: 'Téléchargement des marées depuis le SHOM…',
    de: 'Gezeiten werden vom SHOM heruntergeladen…',
    es: 'Descargando las mareas del SHOM…',
  },

  // configuration actions
  findEmpty: {
    en: 'Type a few letters of the harbor name first.',
    fr: 'Tapez d’abord quelques lettres du nom du port.',
    de: 'Geben Sie zuerst einige Buchstaben des Hafennamens ein.',
    es: 'Escriba primero algunas letras del nombre del puerto.',
  },
  findNone: {
    en: 'No harbor matches "{query}".',
    fr: 'Aucun port ne correspond à « {query} ».',
    de: 'Kein Hafen passt zu „{query}“.',
    es: 'Ningún puerto coincide con «{query}».',
  },
  findResults: {
    en: '{n} found: {ports}. Copy the name into "Other harbors".',
    fr: '{n} trouvé(s) : {ports}. Copiez le nom dans « Autres ports ».',
    de: '{n} gefunden: {ports}. Namen in „Weitere Häfen“ kopieren.',
    es: '{n} encontrado(s): {ports}. Copie el nombre en «Otros puertos».',
  },
  refreshOk: {
    en: 'Tides downloaded for {n} harbor(s).',
    fr: 'Marées téléchargées pour {n} port(s).',
    de: 'Gezeiten für {n} Hafen/Häfen heruntergeladen.',
    es: 'Mareas descargadas para {n} puerto(s).',
  },
  refreshFailed: {
    en: 'Download failed for {ports}: {reason}',
    fr: 'Échec du téléchargement pour {ports} : {reason}',
    de: 'Download für {ports} fehlgeschlagen: {reason}',
    es: 'Falló la descarga para {ports}: {reason}',
  },
  diagnosticDone: {
    en: 'Diagnostic written to the Logs tab ({ports} harbor(s), {fired} scene events in 3 days).',
    fr: 'Diagnostic écrit dans l’onglet Journaux ({ports} port(s), {fired} événements de scène en 3 jours).',
    de: 'Diagnose im Reiter Protokolle ({ports} Hafen/Häfen, {fired} Szenenereignisse in 3 Tagen).',
    es: 'Diagnóstico escrito en la pestaña Registros ({ports} puerto(s), {fired} eventos de escena en 3 días).',
  },
};

/**
 * @description Whether a value is one of the languages of the integration.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de, es.
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language (English fallback), with its
 * substitutions.
 * @param {string} key - The TEXTS key.
 * @param {string} language - The language.
 * @param {object} [values] - The substitutions.
 * @returns {string} The text.
 * @example
 * t('radioDeviceName', 'de', { band: '5 GHz' }); // -> 'WLAN 5 GHz'
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[language] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/**
 * @description The text in every language, for a multi-language message.
 * @param {string} key - The TEXTS key.
 * @param {object} [values] - The substitutions.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 * @example
 * all('testOk', { model: 'RT-AX88U', firmware: '3.0.0.4.388_24198' });
 */
function all(key, values = {}) {
  return Object.fromEntries(LANGUAGES.map((language) => [language, t(key, language, values)]));
}

/**
 * @description A number written the way a language does, with at most
 * `digits` decimals ("7,2" in French).
 * @param {number|null} value - The number.
 * @param {string} language - The language.
 * @param {number} digits - The decimals.
 * @returns {string} The text, "?" when unknown.
 * @example
 * formatNumber(7.25, 'fr', 1); // -> '7,3'
 */
function formatNumber(value, language, digits) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '?';
  }
  return new Intl.NumberFormat(isLanguage(language) ? language : 'en', {
    maximumFractionDigits: digits,
  }).format(value);
}

export { LANGUAGES, TEXTS, isLanguage, t, all, formatNumber };
