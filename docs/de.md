# Marées France

## Überblick

Diese Integration bringt die Gezeiten französischer Häfen in Gladys, nach den Vorhersagen des SHOM (des hydrografischen Dienstes der französischen Marine, hinter maree.shom.fr): Zeiten und Höhen von Hoch- und Niedrigwasser, Koeffizienten und die Wasserhöhe zu jedem Zeitpunkt. Sie deckt 387 Häfen ab: Festland, Überseegebiete und einige ausländische Häfen.

Jeder Hafen wird ein Gerät, Szenen lösen vor jeder Gezeit oder bei Springtiden aus, und drei Widgets zeigen die Tageskurve, die nächsten Gezeiten und die Koeffizienten.

![Die drei Widgets: Gezeit des Tages mit Kurve, nächste Gezeiten, Gezeitenkoeffizienten (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-marees-france/main/docs/assets/widgets.de.png)

Die Vorhersagen sind Eigentum des SHOM und ersetzen keine amtlichen nautischen Unterlagen. Diese Community-Integration ist nicht mit dem SHOM verbunden.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Internetzugang von Gladys. Kein Konto, kein Schlüssel.

## Konfiguration

| Feld              | Rolle                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------ |
| Hafen             | Der Haupthafen aus der SHOM-Liste. Anfangsbuchstaben tippen, um hinzuspringen.             |
| Weitere Häfen     | Bis zu vier weitere, nach Namen, durch Kommas getrennt: `Saint-Malo, Roscoff`.             |
| Sprache der Texte | Sprache der Gerätenamen, Textzustände und Szenen-Zusammenfassungen. Standard: automatisch. |

Die Schaltfläche **Hafen suchen** prüft einen Namen (Akzente und Groß-/Kleinschreibung egal) und zeigt die passenden Häfen. **Jetzt herunterladen** lädt die Gezeiten erneut (geschieht sonst einmal täglich nachts). Der Verbindungsstatus nennt die verfolgten Häfen und nicht gefundene Namen.

## Verwendung

### Geräte

Den Reiter **Entdecken** öffnen und die Geräte „Gezeiten &lt;Hafen&gt;“ hinzufügen. Jedes hat: die Wasserhöhe (m, in 5-Minuten-Schritten), die Gezeit (steigend oder fallend), die nächste Gezeit im Klartext („Hochwasser um 20:22 (6,07 m, Koeff. 62)“), die Minuten bis zum nächsten Hoch- und Niedrigwasser und deren Höhen, den Koeffizienten des nächsten Hochwassers und den höchsten Koeffizienten von morgen (für Häfen mit Koeffizienten). Höhen über Seekartennull, wie auf maree.shom.fr; die Zeiten folgen der Zeitzone von Gladys.

### Dashboard-Widgets

- **Gezeit des Tages**: Wasserhöhe, Tendenz, nächste Gezeit, Koeffizient und Tageskurve mit Hoch- und Niedrigwasser.
- **Nächste Gezeiten**: die nächsten acht, datiert, mit Koeffizient.
- **Gezeitenkoeffizienten**: zwei Wochen als Balken, Spitze und nächste Springtide (Koeffizient ≥ 95).

Jedes Widget hat eine Einstellung **Hafen** (ein bereits hinzugefügtes Hafengerät); leer zeigt es den ersten Hafen der Konfiguration.

### Szenen

- **Gezeiten: Hoch- oder Niedrigwasser**: zur Zeit der Gezeit oder 15 Minuten bis 6 Stunden vorher. Filter: Hafen, Gezeitentyp.
- **Gezeiten: Springtide**: ein Hochwasser, dessen Koeffizient eine Schwelle erreicht (70 bis 115), zu seiner Zeit oder bis zum Vortag. Die Zeit des folgenden Niedrigwassers wird geliefert.
- Aktion **Gezeiten: nächste Gezeit lesen**: Zeit, Höhe, Koeffizient, aktuelle Höhe und eine Zusammenfassung für eine Nachricht.

Beispiele: eine Stunde vor Hochwasser Zeit und Höhe per Telegram senden; am Vortag einer Springtide mit Koeffizient 95 oder mehr ans Wattfischen erinnern; bei Niedrigwasser einen Rollladen schließen.

Ein um mehr als 10 Minuten verpasstes Ereignis (Gladys gestoppt) wird nicht nachgeholt, und jedes Ereignis wird nur einmal gesendet, auch nach einem Neustart.

### Transport

Die Daten kommen von den Diensten des SHOM über das Internet (Badge „Cloud“). Nur der Hafencode steht in den Anfragen: Nichts über Sie verlässt Ihr Netzwerk. Drei Anfragen pro Hafen und Tag genügen; alles andere wird im Container berechnet.

## Fehlerbehebung

- **„Hafen nicht gefunden“**: die Schaltfläche Hafen suchen nutzen und den genauen Namen in „Weitere Häfen“ kopieren.
- **„Der SHOM lehnt die Anfragen ab“**: Seine Firewall sperrt manchmal eine Adresse eine Weile. Die Integration versucht es einige Stunden später von selbst und behält die Daten der Vortage (8 Tage Gezeiten).
- **Kein Koeffizient**: Der SHOM veröffentlicht für manche Überseehäfen keinen.
- **Fehlerbericht**: auf **Diagnose** klicken und die Zeilen „Diagnostic:“ aus dem Reiter Protokolle kopieren, mit den Versionen von Gladys und der Integration (Gladys übergibt `DEBUG` nicht an den Container).
