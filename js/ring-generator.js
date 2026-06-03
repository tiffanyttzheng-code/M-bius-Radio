(function () {
  const app = document.querySelector(".ring-app");
  const preview = document.getElementById("preview-shape");
  const opacityRange = document.getElementById("opacity-range");
  const radiusRange = document.getElementById("radius-range");
  const opacityOutput = document.getElementById("opacity-output");
  const radiusOutput = document.getElementById("radius-output");
  const fillColor = document.getElementById("fill-color");
  const strokeColor = document.getElementById("stroke-color");
  const fillHex = document.getElementById("fill-hex");
  const strokeHex = document.getElementById("stroke-hex");
  const strokeWeight = document.getElementById("stroke-weight");
  const exportButton = document.getElementById("export-png");

  function setStep(step) {
    app.dataset.step = step;
    document.querySelectorAll("[data-step]").forEach((button) => {
      button.classList.toggle("active", button.dataset.step === step);
    });
  }

  function setShape(shape) {
    preview.className = `preview-shape ${shape}`;
    document.querySelectorAll(".shape-option").forEach((button) => {
      button.classList.toggle("active", button.dataset.shape === shape);
    });
    updatePreview();
  }

  function updatePreview() {
    const opacity = Number(opacityRange.value);
    const radius = Number(radiusRange.value);
    const fill = fillColor.value;
    const stroke = strokeColor.value;
    const weight = Number(strokeWeight.value || 0);

    opacityOutput.value = `${opacity}%`;
    radiusOutput.value = String(radius);
    fillHex.textContent = fill.slice(1).toUpperCase();
    strokeHex.textContent = stroke.slice(1).toUpperCase();

    preview.style.opacity = opacity / 100;
    preview.style.borderRadius = `${radius}px`;
    preview.style.backgroundColor = fill;
    preview.style.borderColor = stroke;
    preview.style.borderWidth = `${weight}px`;

    if (preview.classList.contains("ellipse")) {
      preview.style.backgroundColor = "transparent";
    }
  }

  function exportPng() {
    const canvasCard = document.querySelector(".canvas-card");
    const rect = canvasCard.getBoundingClientRect();
    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = Math.round(rect.width * scale);
    canvas.height = Math.round(rect.height * scale);
    const ctx = canvas.getContext("2d");

    ctx.scale(scale, scale);
    ctx.fillStyle = "#272727";
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    for (let x = 0; x < rect.width; x += 15) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rect.height);
      ctx.stroke();
    }
    for (let y = 0; y < rect.height; y += 15) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    for (let x = 0; x < rect.width; x += 75) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rect.height);
      ctx.stroke();
    }
    for (let y = 0; y < rect.height; y += 75) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
    }

    const centerX = rect.width / 2;
    const centerY = rect.height * 0.46;
    ctx.globalAlpha = Number(opacityRange.value) / 100;
    ctx.fillStyle = fillColor.value;
    ctx.strokeStyle = strokeColor.value;
    ctx.lineWidth = Number(strokeWeight.value || 0);

    if (preview.classList.contains("ellipse")) {
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, 36, 36, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (preview.classList.contains("polygon")) {
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - 38);
      ctx.lineTo(centerX + 42, centerY + 38);
      ctx.lineTo(centerX - 42, centerY + 38);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      const width = preview.classList.contains("line") ? 1 : 2;
      ctx.fillRect(centerX - width / 2, centerY - 63, width, 126);
    }

    const link = document.createElement("a");
    link.download = "ring-generator-preview.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  document.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => setStep(button.dataset.step));
  });

  document.querySelectorAll(".shape-option").forEach((button) => {
    button.addEventListener("click", () => setShape(button.dataset.shape));
  });

  document.querySelectorAll(".preset-card").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".preset-card").forEach((preset) => preset.classList.remove("active"));
      button.classList.add("active");
    });
  });

  document.getElementById("next-step").addEventListener("click", () => {
    const current = Number(app.dataset.step || "1");
    setStep(String(current >= 3 ? 1 : current + 1));
  });

  document.getElementById("add-preset").addEventListener("click", () => {
    const activePreset = document.querySelector(".preset-card.active");
    if (activePreset) {
      activePreset.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }],
        { duration: 220, easing: "ease-out" }
      );
    }
  });

  [opacityRange, radiusRange, fillColor, strokeColor, strokeWeight].forEach((input) => {
    input.addEventListener("input", updatePreview);
  });

  exportButton.addEventListener("click", exportPng);
  updatePreview();
})();
