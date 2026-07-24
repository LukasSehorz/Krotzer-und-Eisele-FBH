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

// Reihenfolge + Beschriftung der Felder in der Mail:
const FIELD_LABELS = {
  name: "Name",
  telefon: "Telefon",
  email: "E-Mail",
  objektadresse: "Objektadresse / Ort",
  anschrift: "Vollständige Anschrift",
  objektart: "Art des Objekts",
  flaeche: "Fläche (m²)",
  raeume: "Anzahl Räume",
  baujahr: "Baujahr",
  etage: "Etage(n)",
  bodenbelag: "Vorhandener Bodenbelag",
  "belag-entfernt": "Bodenbelag entfernt?",
  estrichart: "Estrichart",
  risse: "Risse / Hohlstellen",
  verteiler: "Heizkreisverteiler",
  heizungsbauer: "Heizungsbauer beauftragt?",
  waermeerzeuger: "Wärmeerzeuger",
  baustrom: "Baustromanschluss",
  zeitraum: "Gewünschter Zeitraum",
  nachricht: "Nachricht",
  datenschutz: "Datenschutz akzeptiert"
};

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

  // Eindeutiger Betreff pro Anfrage -> jede Mail landet als eigener Eintrag.
  const now = new Date();
  const pad = function (n) { return String(n).padStart(2, "0"); };
  const stamp = pad(now.getUTCDate()) + "." + pad(now.getUTCMonth() + 1) + ". " +
                pad(now.getUTCHours()) + ":" + pad(now.getUTCMinutes());
  const subject = "Fräs-Anfrage: " + fields.name +
                  (fields.objektadresse ? " – " + fields.objektadresse : "") + " · " + stamp;

  // HTML-Tabelle aus den Feldern bauen.
  let rows = "";
  Object.keys(FIELD_LABELS).forEach(function (k) {
    const v = fields[k];
    if (v != null && String(v).trim() !== "") {
      rows +=
        '<tr>' +
        '<td style="padding:8px 12px;font-weight:600;background:#f6f6f6;border:1px solid #ececec;vertical-align:top;white-space:nowrap">' + esc(FIELD_LABELS[k]) + '</td>' +
        '<td style="padding:8px 12px;border:1px solid #ececec">' + esc(v).replace(/\n/g, "<br>") + '</td>' +
        '</tr>';
    }
  });

  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:660px">' +
    '<h2 style="color:#c0392b;margin:0 0 4px">Neue Anfrage über die Website</h2>' +
    '<p style="margin:0 0 16px;color:#777;font-size:13px">' + esc(subject) + '</p>' +
    '<table style="border-collapse:collapse;width:100%;font-size:14px">' + rows + '</table>' +
    (attachments.length ? '<p style="margin-top:14px;color:#555;font-size:13px">' + attachments.length + ' Datei(en) im Anhang.</p>' : '') +
    '<p style="margin-top:20px;color:#aaa;font-size:12px">Automatisch gesendet von ke-fraestechnik.de</p>' +
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
