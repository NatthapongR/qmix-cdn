/*!
 * diagram-chain.js (NEW - uses plantName)
 * Dept -> Section -> Division -> Plant chain dropdown
 *
 * Expected row fields:
 *  - departmentName, sectionName, divisionName, plantCode, plantName
 *
 * API can return either:
 *  A) Array: [ {...}, {...} ]
 *  B) Object: { allData:[...], initial:{...} }
 */

(function (window, document) {
    "use strict";

    const byId = (id) => document.getElementById(id);
    const unique = (arr) => [...new Set((arr || []).filter(Boolean))];

    function getPlantName(r) {
        return r?.plantName ?? "";
    }

    function setOptions(selectEl, items, valueGetter, labelGetter, includeAll, selectedValue) {
        if (!selectEl) return;

        const prev = selectEl.value;
        selectEl.innerHTML = "";

        if (includeAll) {
            const optAll = document.createElement("option");
            optAll.value = "";
            optAll.textContent = "All";
            selectEl.appendChild(optAll);
        }

        (items || []).forEach((item) => {
            const opt = document.createElement("option");
            opt.value = valueGetter(item) ?? "";
            opt.textContent = labelGetter(item) ?? "";
            selectEl.appendChild(opt);
        });

        const want = (selectedValue ?? prev ?? "");
        selectEl.value = want;
        if (selectEl.value !== want) selectEl.value = "";
    }

    function listDepartments(rows) {
        return unique(rows.map((r) => r.departmentName)).sort();
    }
    function listSections(rows) {
        return unique(rows.map((r) => r.sectionName)).sort();
    }
    function listDivisions(rows) {
        return unique(rows.map((r) => r.divisionName)).sort();
    }
    function listPlants(rows) {
        const seen = new Set();
        const out = [];
        rows.forEach((r) => {
            const key = `${r.plantCode}|${getPlantName(r)}`;
            if (!seen.has(key)) {
                seen.add(key);
                out.push(r);
            }
        });
        return out;
    }

    function makeChain(allData, ids) {
        const ID = Object.assign(
            {
                dept: "deptSelect",
                section: "sectionSelect",
                division: "divisionSelect",
                plant: "plantSelect",
            },
            ids || {}
        );

        function reloadChain({ dept = "", sect = "", div = "", plant = "" } = {}) {
            const deptEl = byId(ID.dept);
            const sectionEl = byId(ID.section);
            const divisionEl = byId(ID.division);
            const plantEl = byId(ID.plant);

            // 1) Dept
            setOptions(deptEl, listDepartments(allData), (x) => x, (x) => x, true, dept);

            // 2) Section
            let rows = allData;
            if (dept) rows = rows.filter((r) => r.departmentName === dept);
            setOptions(sectionEl, listSections(rows), (x) => x, (x) => x, true, sect);

            // 3) Division
            let rows2 = rows;
            if (sect) rows2 = rows2.filter((r) => r.sectionName === sect);
            setOptions(divisionEl, listDivisions(rows2), (x) => x, (x) => x, true, div);

            // 4) Plant
            let rows3 = rows2;
            if (div) rows3 = rows3.filter((r) => r.divisionName === div);

            const plants = listPlants(rows3);
            setOptions(
                plantEl,
                plants,
                (r) => r.plantCode,
                (r) => `${r.plantCode} - ${getPlantName(r)}`,
                true,
                plant
            );
        }

        function currentFilters() {
            return {
                dept: byId(ID.dept)?.value ?? "",
                sect: byId(ID.section)?.value ?? "",
                div: byId(ID.division)?.value ?? "",
            };
        }

        function updateSection() {
            const { dept } = currentFilters();
            reloadChain({ dept, sect: "", div: "", plant: "" });
        }
        function updateDivision() {
            const { dept, sect } = currentFilters();
            reloadChain({ dept, sect, div: "", plant: "" });
        }
        function updatePlant() {
            const { dept, sect, div } = currentFilters();
            reloadChain({ dept, sect, div, plant: "" });
        }

        return { reloadChain, updateSection, updateDivision, updatePlant };
    }

    async function init(cfg) {
        cfg = cfg || {};

        const ids = Object.assign(
            { dept: "deptSelect", section: "sectionSelect", division: "divisionSelect", plant: "plantSelect" },
            cfg.ids || {}
        );

        const apiUrl =
            cfg.apiUrl ||
            ((cfg.apiBaseUrl || "").replace(/\/$/, "") + (cfg.bootstrapPath || "/api/diagram/bootstrap"));

        const res = await fetch(apiUrl, {
            method: "GET",
            headers: cfg.headers || {},
            credentials: cfg.withCredentials ? "include" : "same-origin",
        });
        if (!res.ok) throw new Error(`bootstrap failed: ${res.status}`);

        const payload = await res.json();

        // supports both array and {allData, initial}
        const isArrayPayload = Array.isArray(payload);
        const allData = isArrayPayload ? payload : (payload?.allData || []);
        const initial = Object.assign({}, isArrayPayload ? {} : (payload?.initial || {}), cfg.initialOverride || {});

        const chain = makeChain(allData, ids);

        // bind events
        byId(ids.dept)?.addEventListener("change", chain.updateSection);
        byId(ids.section)?.addEventListener("change", chain.updateDivision);
        byId(ids.division)?.addEventListener("change", chain.updatePlant);

        // first load with initial values (if any)
        chain.reloadChain({
            dept: initial?.dept || "",
            sect: initial?.sect || "",
            div: initial?.divs || "",
            plant: initial?.plant || "",
        });

        // expose handlers for inline onchange usage
        window.updateSection = chain.updateSection;
        window.updateDivision = chain.updateDivision;
        window.updatePlant = chain.updatePlant;

        return { allData, initial };
    }

    window.DiagramChain = { init };
})(window, document);
