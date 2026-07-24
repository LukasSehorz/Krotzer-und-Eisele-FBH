/**
 * Kontaktformular -> Resend
 * Nimmt die Anfrage als JSON entgegen und verschickt sie per Resend-API als E-Mail.
 * Der API-Key liegt ausschließlich als Netlify-Environment-Variable RESEND_API_KEY vor.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Empfänger der Anfragen:
const TO = "ke.fraestechnik@gmail.com";
// Absender – Domain muss in Resend verifiziert sein:
const FROM = "Krotzer & Eisele Website <anfrage@ke-fraestechnik.de>";

// Markenfarben (aus css/style.css):
const RED = "#E1322A";
const INK = "#1E1518";

// Felder gruppiert in Abschnitte – Reihenfolge + Beschriftung in der Mail:
const SECTIONS = [
  { title: "Kontakt", fields: [
    ["name", "Name"], ["telefon", "Telefon"], ["email", "E-Mail"]
  ]},
  { title: "Objekt", fields: [
    ["objektadresse", "Objektadresse / Ort"], ["anschrift", "Vollständige Anschrift"],
    ["objektart", "Art des Objekts"], ["flaeche", "Fläche (m²)"],
    ["raeume", "Anzahl Räume"], ["baujahr", "Baujahr"], ["etage", "Etage(n)"]
  ]},
  { title: "Bauliche Details", fields: [
    ["bodenbelag", "Vorhandener Bodenbelag"], ["belag-entfernt", "Bodenbelag entfernt?"],
    ["estrichart", "Estrichart"], ["risse", "Risse / Hohlstellen"],
    ["verteiler", "Heizkreisverteiler"], ["heizungsbauer", "Heizungsbauer beauftragt?"],
    ["waermeerzeuger", "Wärmeerzeuger"], ["baustrom", "Baustromanschluss"]
  ]},
  { title: "Projekt", fields: [
    ["zeitraum", "Gewünschter Zeitraum"], ["nachricht", "Nachricht"],
    ["datenschutz", "Datenschutz akzeptiert"]
  ]}
];

function telHref(s) { return String(s == null ? "" : s).replace(/[^\d+]/g, ""); }

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

function json(statusCode, obj) {
  return {
    statusCode: statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj)
  };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return json(500, { error: "Server nicht konfiguriert (RESEND_API_KEY fehlt)." });
  }

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch (e) {
    return json(400, { error: "Ungültige Anfrage." });
  }

  // Spam-Schutz (Honeypot): ist das versteckte Feld gefüllt -> stiller Erfolg, keine Mail.
  if (data.botField) {
    return json(200, { ok: true });
  }

  const fields = data.fields || {};
  const attachments = Array.isArray(data.attachments) ? data.attachments : [];

  if (!fields.name || !fields.email) {
    return json(400, { error: "Pflichtfelder fehlen." });
  }

  // Zeitstempel in deutscher Zeit (Europe/Berlin).
  const now = new Date();
  let stamp;
  try {
    stamp = now.toLocaleString("de-DE", {
      timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  } catch (e) {
    stamp = now.toISOString().slice(0, 16).replace("T", " ");
  }

  // Eindeutiger Betreff pro Anfrage -> jede Mail landet als eigener Eintrag.
  const subject = "Fräs-Anfrage: " + fields.name +
                  (fields.objektadresse ? " – " + fields.objektadresse : "") + " · " + stamp;

  // Kontakt-Kurzinfo (klickbar).
  const telLink = fields.telefon
    ? '<a href="tel:' + esc(telHref(fields.telefon)) + '" style="color:' + RED + ';text-decoration:none">' + esc(fields.telefon) + '</a>'
    : "–";
  const mailLink = fields.email
    ? '<a href="mailto:' + esc(fields.email) + '" style="color:' + RED + ';text-decoration:none">' + esc(fields.email) + '</a>'
    : "–";

  // Abschnitte -> Tabellenzeilen.
  let sectionsHtml = "";
  SECTIONS.forEach(function (sec) {
    let rows = "";
    sec.fields.forEach(function (f) {
      const v = fields[f[0]];
      if (v != null && String(v).trim() !== "") {
        rows +=
          '<tr>' +
          '<td style="padding:9px 16px;font-weight:600;color:#6d6a6b;background:#faf8f8;border-bottom:1px solid #eee;width:42%;vertical-align:top">' + esc(f[1]) + '</td>' +
          '<td style="padding:9px 16px;color:' + INK + ';border-bottom:1px solid #eee;vertical-align:top">' + esc(v).replace(/\n/g, "<br>") + '</td>' +
          '</tr>';
      }
    });
    if (rows) {
      sectionsHtml +=
        '<tr><td colspan="2" style="padding:20px 16px 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:' + RED + '">' + esc(sec.title) + '</td></tr>' +
        rows;
    }
  });

  const html =
    '<div style="margin:0;padding:24px 12px;background:#f0ecec;font-family:Arial,Helvetica,sans-serif">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e7e3e3">' +
      '<tr><td style="background:' + RED + ';padding:22px 24px">' +
        '<div style="color:#fff;font-size:19px;font-weight:700;line-height:1.2">Neue Anfrage über die Website</div>' +
        '<div style="color:rgba(255,255,255,.85);font-size:13px;margin-top:3px">Krotzer &amp; Eisele GmbH · eingegangen am ' + esc(stamp) + ' Uhr</div>' +
      '</td></tr>' +
      '<tr><td style="padding:22px 24px 6px">' +
        '<div style="font-size:20px;font-weight:700;color:' + INK + '">' + esc(fields.name || "—") + '</div>' +
        '<div style="font-size:14px;color:#444;margin-top:7px">Tel.: ' + telLink + ' &nbsp;·&nbsp; ' + mailLink + '</div>' +
      '</td></tr>' +
      '<tr><td style="padding:4px 10px 6px">' +
        '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">' + sectionsHtml + '</table>' +
      '</td></tr>' +
      (attachments.length
        ? '<tr><td style="padding:6px 24px 0"><div style="font-size:13px;color:#555;background:#faf8f8;border:1px solid #eee;border-radius:8px;padding:11px 14px">📎 ' + attachments.length + ' Datei(en) im Anhang</div></td></tr>'
        : '') +
      '<tr><td style="padding:20px 24px 26px">' +
        '<div style="border-top:1px solid #eee;padding-top:14px;font-size:12px;color:#999;line-height:1.5">Automatisch erzeugt über das Kontaktformular auf ke-fraestechnik.de. ' +
        'Sie können direkt auf diese E-Mail antworten – die Antwort geht an den Interessenten.</div>' +
      '</td></tr>' +
    '</table>' +
    '</div>';

  const payload = {
    from: FROM,
    to: [TO],
    reply_to: fields.email,
    subject: subject,
    html: html
  };

  if (attachments.length) {
    payload.attachments = attachments
      .filter(function (a) { return a && a.content; })
      .map(function (a) { return { filename: a.filename || "anhang.jpg", content: a.content }; });
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const detail = await res.text();
      return json(502, { error: "Mailversand fehlgeschlagen.", detail: detail });
    }
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: "Serverfehler beim Mailversand.", detail: String(e) });
  }
};
