// Réglages modifiables pendant l'exécution (menus et sliders de index.html).
// Les entités ne lisent pas ce module : la scène leur applique les valeurs à chaque image.
const SceneSettings = (() => {
  const FRAMES_PER_SECOND = 60;

  function defaults() {
    return {
      // véhicules
      vehicleBehavior: 'seek',     // 'seek' | 'pursue'
      vehicleMaxSpeed: 4,
      vehicleMaxForce: 0.1,        // intensité du pilotage des véhicules
      vehicleAnticipation: 10,     // images (pursue)
      // cibles
      targetThreat: 'evade',       // 'evade' | 'flee' | 'ignore'
      targetCalm: 'mouse',         // 'mouse' | 'wander'
      detectionRadius: 100,        // rayon de vision (px)
      calmSpeed: 2,
      panicSpeed: 6,
      targetMaxForce: 0.3,         // intensité de la fuite
      targetAnticipation: 10,      // images (evade)
      maxThreats: 8,               // menaces les plus proches prises en compte
      wanderJitter: 0.3,           // radians par image
      divisionDelay: 8,            // secondes
      budPush: 0.5,                // poussée de séparation mère/fille (fraction de maxForce)
      maxTargets: 8,
      targetHealth: 5,             // coups encaissés avant d'éclater
      // affichage
      debug: false,
      smoke: true,
      autoQuality: true,           // allège les effets si une image dépasse le budget de 60 FPS
      gpuVehicles: true,           // rendu instancié WebGL2 (repli sur VehicleBatch sinon)
    };
  }

  function applyToHunter(hunter, s) {
    hunter.setMode(s.vehicleBehavior);
    hunter.maxSpeed = s.vehicleMaxSpeed;
    hunter.maxForce = s.vehicleMaxForce;
    hunter.anticipation = s.vehicleAnticipation;
  }

  // quality (optionnel) : niveau de QualityGovernor, qui peut plafonner les menaces perçues
  function applyToTarget(target, s, quality = null) {
    target.threatMode = s.targetThreat;
    target.calmMode = s.targetCalm;
    target.rayonDetection = s.detectionRadius;
    target.vitesseCalme = s.calmSpeed;
    // l'allure de panique ne descend jamais sous l'allure calme
    target.vitesseFuiteMax = Math.max(s.panicSpeed, s.calmSpeed);
    target.maxForce = s.targetMaxForce;
    target.anticipation = s.targetAnticipation;
    target.maxMenaces = Math.min(s.maxThreats, quality ? quality.threatCap : Infinity);
    target.wanderJitter = s.wanderJitter;
    target.divisionDelay = Math.round(s.divisionDelay * FRAMES_PER_SECOND);
    target.budPush = s.budPush;
    target.debug = s.debug;
    target.maxHealth = s.targetHealth;
  }

  return { FRAMES_PER_SECOND, defaults, applyToHunter, applyToTarget };
})();
