document.addEventListener("DOMContentLoaded", loadNCRData);
async function loadNCRData() {
    console.log("📡 Fetching NCR data...");
    
    let tableBody = document.getElementById("ncrTableBody");
    if (!tableBody) {
        console.error("❌ NCR table body not found.");
        return;
    }

    try {
        let response = await fetch("/api/ncr");
        if (!response.ok) throw new Error("❌ Failed to fetch NCR data");

        let ncrData = await response.json();
        console.log("✅ NCR Data Loaded:", ncrData);

        if (ncrData.length === 0) {
            console.warn("⚠️ No NCR records found.");
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center">No NCR records found.</td></tr>`;
            return;
        }

        let fragment = document.createDocumentFragment();
data.slice(0, 50).forEach(ncr => {  // Display only the first 50 records for now
    let row = document.createElement("tr");
    row.innerHTML = `
        <td>${ncr.ncr_number || "N/A"}</td>
        <td>${ncr.job_number || "N/A"}</td>
        <td>${ncr.work_order || "N/A"}</td>
        <td>${ncr.operation_number || "N/A"}</td>
        <td>${ncr.planned_hours || "0"}</td>
        <td>${ncr.actual_hours || "0"}</td>
        <td>${ncr.issue_description || "N/A"}</td>
        <td>${ncr.status || "Unknown"}</td>
    `;
    fragment.appendChild(row);
});
document.getElementById("ncrTableBody").appendChild(fragment);


        console.log(`✅ Table updated with ${ncrData.length} records.`);

    } catch (error) {
        console.error("❌ Error loading NCR data:", error);
    }
}
fetch("/api/ncr?limit=50") // Adjust backend to support limit query
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));
