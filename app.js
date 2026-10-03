// ============================================================
// Dew Point House Monitor
// Main application
// ============================================================

const SUPABASE_URL = "PASTE-YOUR-SUPABASE-PROJECT-URL-HERE";
const SUPABASE_PUBLISHABLE_KEY = "PASTE-YOUR-SUPABASE-PUBLISHABLE-KEY-HERE";

const LOCATIONS = [
  { id: "outside", name: "Outside" },
  { id: "bedroom", name: "Bedroom" },
  { id: "landing", name: "Landing" },
  { id: "study", name: "Study" },
  { id: "kitchen", name: "Kitchen" },
  { id: "basement", name: "Basement" }
];


// ------------------------------------------------------------
// Supabase
// ------------------------------------------------------------

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);


// ------------------------------------------------------------
// Dew point calculation
// ------------------------------------------------------------

function calculateDewPoint(temperature, humidity) {

  if (
    temperature === null ||
    humidity === null ||
    Number.isNaN(temperature) ||
    Number.isNaN(humidity)
  ) {
    return null;
  }

  const a = 17.62;
  const b = 243.12;

  const gamma =
    Math.log(humidity / 100) +
    (a * temperature) / (b + temperature);

  const dewPoint =
    (b * gamma) /
    (a - gamma);

  return Math.round(dewPoint * 10) / 10;
}


// ------------------------------------------------------------
// Date/time
// ------------------------------------------------------------

function getTimestamp() {
  return new Date().toISOString();
}


function formatTime(timestamp) {

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  ).format(new Date(timestamp));

}


// ------------------------------------------------------------
// Create a new input row
// ------------------------------------------------------------

function createReadingRow() {

  const tbody =
    document.getElementById("readings-table");

  const row =
    document.createElement("tr");

  const timeCell =
    document.createElement("td");

  timeCell.textContent =
    "Not saved";

  timeCell.className =
    "reading-time";

  row.appendChild(timeCell);


  LOCATIONS.forEach(location => {

    const cell =
      document.createElement("td");

    const temp =
      document.createElement("input");

    temp.type = "number";
    temp.step = "0.1";
    temp.placeholder = "°C";

    temp.className =
      "temperature";

    temp.dataset.location =
      location.id;


    const humidity =
      document.createElement("input");

    humidity.type = "number";
    humidity.step = "1";
    humidity.min = "0";
    humidity.max = "100";

    humidity.placeholder =
      "% RH";

    humidity.className =
      "humidity";

    humidity.dataset.location =
      location.id;


    cell.appendChild(temp);

    cell.appendChild(
      document.createElement("br")
    );

    cell.appendChild(humidity);

    row.appendChild(cell);

  });


  const deleteCell =
    document.createElement("td");

  const deleteButton =
    document.createElement("button");

  deleteButton.textContent =
    "Delete";

  deleteButton.className =
    "danger";

  deleteButton.addEventListener(
    "click",
    () => row.remove()
  );

  deleteCell.appendChild(
    deleteButton
  );

  row.appendChild(deleteCell);

  tbody.appendChild(row);
}


// ------------------------------------------------------------
// Save readings
// ------------------------------------------------------------

async function saveReadings() {

  const rows =
    document.querySelectorAll(
      "#readings-table tr"
    );

  const recordedAt =
    getTimestamp();

  let anythingEntered =
    false;


  // Create one session for this press of Save.
  const {
    data: session,
    error: sessionError
  } = await supabase
    .from("reading_sessions")
    .insert({
      recorded_at: recordedAt
    })
    .select()
    .single();


  if (sessionError) {

    console.error(sessionError);

    alert(
      "There was a problem saving the readings."
    );

    return;
  }


  for (const row of rows) {

    for (const location of LOCATIONS) {

      const tempInput =
        row.querySelector(
          `.temperature[data-location="${location.id}"]`
        );

      const humidityInput =
        row.querySelector(
          `.humidity[data-location="${location.id}"]`
        );


      const tempValue =
        tempInput.value.trim();

      const humidityValue =
        humidityInput.value.trim();


      // Nothing entered for this location.
      if (
        tempValue === "" &&
        humidityValue === ""
      ) {
        continue;
      }


      anythingEntered = true;


      const temperature =
        tempValue === ""
          ? null
          : Number(tempValue);


      const humidity =
        humidityValue === ""
          ? null
          : Number(humidityValue);


      const dewPoint =
        temperature !== null &&
        humidity !== null
          ? calculateDewPoint(
              temperature,
              humidity
            )
          : null;


      const {
        error
      } = await supabase
        .from("readings")
        .insert({
          session_id: session.id,
          location_id: location.id,
          temperature,
          humidity,
          dew_point: dewPoint
        });


      if (error) {

        console.error(error);

        alert(
          `There was a problem saving the ${location.name} reading.`
        );

        return;
      }

    }

  }


  if (!anythingEntered) {

    // Remove the empty session we just created.
    await supabase
      .from("reading_sessions")
      .delete()
      .eq("id", session.id);

    alert(
      "Please enter at least one reading."
    );

    return;
  }


  alert(
    `Readings saved at ${formatTime(recordedAt)}.`
  );


  await loadTodaysReadings();

}


// ------------------------------------------------------------
// Load today's saved readings
// ------------------------------------------------------------

async function loadTodaysReadings() {

  const today =
    new Date();

  const start =
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

  const end =
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    );


  const {
    data,
    error
  } = await supabase
    .from("readings")
    .select(`
      id,
      location_id,
      temperature,
      humidity,
      dew_point,
      reading_sessions (
        recorded_at
      )
    `)
    .gte(
      "reading_sessions.recorded_at",
      start.toISOString()
    )
    .lt(
      "reading_sessions.recorded_at",
      end.toISOString()
    )
    .order(
      "recorded_at",
      {
        ascending: true
      }
    );


  if (error) {

    console.error(error);

    return;
  }


  displayTodaysReadings(data || []);
}


// ------------------------------------------------------------
// Display today's readings
// ------------------------------------------------------------

function displayTodaysReadings(readings) {

  const container =
    document.getElementById(
      "saved-readings"
    );

  if (!container) return;

  container.innerHTML = "";


  if (readings.length === 0) {

    container.innerHTML =
      "<p>No readings saved today.</p>";

    return;
  }


  const table =
    document.createElement("table");

  table.className =
    "saved-readings-table";


  table.innerHTML = `
    <thead>
      <tr>
        <th>Time</th>
        <th>Location</th>
        <th>Temp</th>
        <th>RH</th>
        <th>DP</th>
        <th></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;


  const tbody =
    table.querySelector("tbody");


  readings.forEach(reading => {

    const row =
      document.createElement("tr");

    const time =
      formatTime(
        reading.reading_sessions.recorded_at
      );


    const location =
      LOCATIONS.find(
        item =>
          item.id === reading.location_id
      );


    row.innerHTML = `
      <td>${time}</td>
      <td>${location?.name || reading.location_id}</td>
      <td>${reading.temperature ?? "—"}</td>
      <td>${reading.humidity ?? "—"}</td>
      <td>${reading.dew_point ?? "—"}</td>
      <td>
        <button
          class="danger"
          data-delete-reading="${reading.id}">
          Delete
        </button>
      </td>
    `;


    tbody.appendChild(row);

  });


  container.appendChild(table);


  container
    .querySelectorAll(
      "[data-delete-reading]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => deleteReading(
          button.dataset.deleteReading
        )
      );

    });

}


// ------------------------------------------------------------
// Delete a saved reading
// ------------------------------------------------------------

async function deleteReading(id) {

  if (
    !confirm(
      "Delete this reading?"
    )
  ) {
    return;
  }


  const {
    error
  } = await supabase
    .from("readings")
    .delete()
    .eq("id", id);


  if (error) {

    console.error(error);

    alert(
      "There was a problem deleting the reading."
    );

    return;
  }


  await loadTodaysReadings();

}


// ------------------------------------------------------------
// Events
// ------------------------------------------------------------

document
  .getElementById("add-reading")
  .addEventListener(
    "click",
    createReadingRow
  );


document
  .getElementById("save-readings")
  .addEventListener(
    "click",
    saveReadings
  );


// ------------------------------------------------------------
// Start
// ------------------------------------------------------------

createReadingRow();

loadTodaysReadings();
