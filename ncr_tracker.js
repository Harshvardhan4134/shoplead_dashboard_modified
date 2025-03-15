document.addEventListener("DOMContentLoaded", function () {
    fetch("/api/ncr_monitor")
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                document.getElementById("ncrAlert").style.display = "block";
            }
        });

    fetch("/api/ncr_report")
        .then(response => response.json())
        .then(data => {
            const tableBody = document.getElementById("ncrTable");
            tableBody.innerHTML = data.map(ncr => `
                <tr>
                    <td>${ncr.ncr_number}</td>
                    <td>${ncr.job_number}</td>
                    <td>${ncr.work_order}</td>
                    <td>${ncr.operation_number}</td>
                    <td>${ncr.issue_description}</td>
                    <td>${ncr.issue_category}</td>
                    <td>${ncr.actual_hours}</td>
                    <td>$${ncr.financial_impact}</td>
                </tr>
            `).join("");
        });
});
