// Liaison générique entre les éléments [data-setting] de la page et l'objet de réglages.
// <select> et <input type="range"> : valeur lue à chaque événement input ;
// <input type="checkbox"> : booléen ; <output for="id"> affiche la valeur courante.
const SettingsControls = (() => {
  function readValue(element) {
    if (element.type === 'checkbox') return element.checked;
    if (element.type === 'range') return Number(element.value);
    return element.value;
  }

  function writeValue(element, value) {
    if (element.type === 'checkbox') element.checked = value;
    else element.value = String(value);
  }

  function formatValue(element, value) {
    if (element.type !== 'range') return String(value);
    const decimals = (String(element.step).split('.')[1] || '').length;
    return `${value.toFixed(decimals)}${element.dataset.unit || ''}`;
  }

  /* elements : éléments portant data-setting ; outputFor(id) renvoie l'<output> associé (ou null).
     Les éléments prennent les valeurs initiales de settings, puis chaque événement
     input/change met à jour settings[data-setting] et l'affichage. */
  function bind(elements, settings, outputFor = () => null, onChange = () => {}) {
    for (const element of elements) {
      const key = element.dataset.setting;
      if (!(key in settings)) throw new Error(`Réglage inconnu : ${key}`);
      writeValue(element, settings[key]);
      const output = outputFor(element.id);
      const synchronize = () => {
        settings[key] = readValue(element);
        if (output) output.value = formatValue(element, settings[key]);
        onChange(key, settings[key]);
      };
      element.addEventListener(element.tagName === 'SELECT' || element.type === 'checkbox' ? 'change' : 'input', synchronize);
      if (output) output.value = formatValue(element, settings[key]);
    }
  }

  return { bind, readValue, formatValue };
})();
