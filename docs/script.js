// IIFE to encapsulate code and avoid polluting the global scope
    (function() {
      // --- Constants and State ---
      const BAR_WEIGHT = 45;
      const exercises = {
        Push: ["Barbell Bench Press", "Overhead Press (OHP)", "Incline Bench Press", "Decline Bench Press"],
        Pull: ["Bent-Over Row", "Pendlay Row", "Barbell Curl", "Barbell Shrug", "Power Clean", "Power Snatch", "Romanian Deadlift", "Conventional Deadlift"],
        Legs: ["Back Squat", "Front Squat", "Overhead Squat", "Barbell Lunge", "Barbell Hip Thrust", "Standing Calf Raise"],
      };
      const plates = { 45: 0, 35: 0, 25: 0, 10: 0, 5: 0, 2.5: 0 };
      const plateOrder = [45, 35, 25, 10, 5, 2.5];

      // Message arrays for randomization
      const SHAME_MESSAGES = [
        "Hi, Welcome to MCdonalds 🍔",
        "Pig alert! 🐷",
        "Congrats on the 'gainz'...",
        "The couch called it wants its potato back! 🍟",
        "Moving up in the world... The scale that is! 📈",
        "Pat your fridge on the back today! ❄️",
        "404 effort not found...",
        "I feel sorry for your toilet... 🚽",
        "You'd think you would learn your lesson by now..."
      ];

      const MOTIVATIONAL_MESSAGES = [
        "You're crushing it! Progress detected!",
        "Every Lb counts!",
        "Numbers don't lie!",
        "One step closer.",
        "Fueling the fire keep burning!",
        "Discipline on display!",
        "You're not just losing weight, you're gaining freedom!",
        "Survey says... Progress!"
      ];

      // Strength-specific message arrays
      const STRENGTH_MOTIVATIONAL = [
        "Yeah buddy! ",
        "Light weight baby!",
        "Whatever you are doing, keep doing it!",
        "Newbie gains! Welcome to the club!",
        "Next up TREN"
      ];

      const STRENGTH_SHAME = [
        "Step it up.",
        "Why bother if you disappoint yourself every time?",
        "Leg day tomorrow, quit your bitching.",
        "Reasses your life choices...",
        "Do me a favor and try harder."
      ];

      // Configuration for tracking thresholds
      const TRACKING_CONFIG = {
        bodyWeight: {
          weeklyThreshold: 0.5,      // lbs - minimum change to trigger modal
          trendThreshold: 0.2,       // lbs - average change for trend analysis
          trendPeriodDays: 21        // days - period for trend calculation (3 weeks)
        },
        strength: {
          lookbackDays: 14,          // days - how far back to check for previous bests
          minSessions: 1             // minimum previous sessions needed for comparison
        }
      };

      // Track used messages to avoid repeats
      let usedShameIndices = JSON.parse(localStorage.getItem('usedShameIndices') || '[]');
      let usedMotivationalIndices = JSON.parse(localStorage.getItem('usedMotivationalIndices') || '[]');
      let usedStrengthMotivationalIndices = JSON.parse(localStorage.getItem('usedStrengthMotivationalIndices') || '[]');
      let usedStrengthShameIndices = JSON.parse(localStorage.getItem('usedStrengthShameIndices') || '[]');

      // Exercise category mapping for color coding
      function getExerciseCategory(exerciseName) {
        for (const [category, exerciseList] of Object.entries(exercises)) {
          if (exerciseList.includes(exerciseName)) {
            return category;
          }
        }
        return null; // For "Other Activity"
      }

      let currentExercise = "";
      let workoutHistory = [];
      let chartInstance = null;
      let confirmAction = null;
      let currentWeekOffset = 0; // 0 = current week, -1 = previous week, -2 = two weeks ago, etc. (negative for past, positive for future)
      let chartViewMode = 'all-time'; // 'all-time' or 'current-week'
      let logSequence = 0; // Sequential counter for logging
      let modalAutoCloseTimer = null; // Track modal timeout to prevent memory leaks
      
      // --- Logging Utility ---
      const LOG_LEVELS = { INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR', DEBUG: 'DEBUG' };
      function log(level, message, data = '') {
          const sequence = ++logSequence;
          const logMessage = `[${sequence}] [${level}] ${message}`;
          
          switch(level) {
              case LOG_LEVELS.WARN:
                  console.warn(logMessage, data);
                  break;
              case LOG_LEVELS.ERROR:
                  console.error(logMessage, data);
                  break;
              default:
                  console.log(logMessage, data);
          }
      }
      
      // --- Safe localStorage Wrapper ---
      function safeSetItem(key, value) {
        try {
          localStorage.setItem(key, value);
          return true;
        } catch (error) {
          if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            log(LOG_LEVELS.ERROR, `localStorage quota exceeded for key: ${key}`);
            alert('Storage quota exceeded. Consider exporting your data and clearing old entries.');
            return false;
          } else {
            log(LOG_LEVELS.ERROR, `localStorage error for key ${key}:`, error);
            return false;
          }
        }
      }

      // --- DOM Element References ---
      const exerciseListContainer = document.getElementById("exerciseListContainer");
      const pushSelect = document.getElementById("pushSelect");
      const pullSelect = document.getElementById("pullSelect");
      const legsSelect = document.getElementById("legsSelect");
      const workoutForm = document.getElementById("workoutForm");
      const historySection = document.getElementById("historySection");
      const exerciseSection = document.getElementById("exerciseSection");
      const activityLogSection = document.getElementById("activityLogSection");
      const totalWeightEl = document.getElementById("totalWeight");
      const selectedExerciseEl = document.getElementById("selectedExercise");
      const historyList = document.getElementById("historyList");
      const errorLog = document.getElementById("errorLog");
      const dateInput = document.getElementById("dateInput");
      const platesGrid = document.getElementById("platesGrid");
      const toggleHistoryBtn = document.getElementById("toggleHistory");
      const confirmModal = document.getElementById('confirmModal');
      const modalConfirmBtn = document.getElementById('modalConfirm');
      const modalCancelBtn = document.getElementById('modalCancel');
      const chartContainer = document.getElementById('chartContainer');
      const chartExerciseSelect = document.getElementById('chartExerciseSelect');
      const loadingOverlay = document.getElementById('loadingOverlay');
      const loadingText = document.getElementById('loadingText');
      const weekRangeEl = document.getElementById('weekRange');
      const weekStatsEl = document.getElementById('weekStats');
      const prevWeekBtn = document.getElementById('prevWeek');
      const nextWeekBtn = document.getElementById('nextWeek');
      const showWeightCheckbox = document.getElementById('showWeight');
      const showVolumeCheckbox = document.getElementById('showVolume');
      const showRPECheckbox = document.getElementById('showRPE');
      const showBodyWeightCheckbox = document.getElementById('showBodyWeight');
      const chartAllTimeBtn = document.getElementById('chartAllTimeBtn');
      const chartCurrentWeekBtn = document.getElementById('chartCurrentWeekBtn');
      const themeToggle = document.getElementById('themeToggle');
      const weightGoalSelect = document.getElementById('weightGoalSelect');
      
      // Settings Elements
      const toggleSettings = document.getElementById('toggleSettings');
      const settingsSection = document.getElementById('settingsSection');
      const motivationalMessagesList = document.getElementById('motivationalMessagesList');
      const shameMessagesList = document.getElementById('shameMessagesList');
      const newMotivationalMessage = document.getElementById('newMotivationalMessage');
      const newShameMessage = document.getElementById('newShameMessage');
      const addMotivationalMessage = document.getElementById('addMotivationalMessage');
      const addShameMessage = document.getElementById('addShameMessage');
      const strengthMotivationalMessagesList = document.getElementById('strengthMotivationalMessagesList');
      const strengthShameMessagesList = document.getElementById('strengthShameMessagesList');
      const newStrengthMotivationalMessage = document.getElementById('newStrengthMotivationalMessage');
      const newStrengthShameMessage = document.getElementById('newStrengthShameMessage');
      const addStrengthMotivationalMessage = document.getElementById('addStrengthMotivationalMessage');
      const addStrengthShameMessage = document.getElementById('addStrengthShameMessage');
      const resetMessages = document.getElementById('resetMessages');
      const clearMessageTracking = document.getElementById('clearMessageTracking');
      
      // Activity Log Elements
      const activityInput = document.getElementById("activityInput");
      const activityDateInput = document.getElementById("activityDateInput");
      const includeBodyWeightCheckbox = document.getElementById('includeBodyWeight');
      const bodyWeightInputDiv = document.getElementById('bodyWeightInput');
      const bodyWeightInput = document.getElementById('bodyWeight');
      
      // Workout Body Weight Elements
      const workoutIncludeBodyWeightCheckbox = document.getElementById('workoutIncludeBodyWeight');
      const workoutBodyWeightInputDiv = document.getElementById('workoutBodyWeightInput');
      const workoutBodyWeightInput = document.getElementById('workoutBodyWeight');

      // Range Sliders and Numeric Inputs
      const setsRange = document.getElementById("setsRange");
      const repsRange = document.getElementById("repsRange");
      const rpeRange = document.getElementById("rpeRange");
      const setsInput = document.getElementById("setsInput");
      const repsInput = document.getElementById("repsInput");
      const rpeInput = document.getElementById("rpeInput");
      const setsLabel = document.getElementById("setsLabel");
      const repsLabel = document.getElementById("repsLabel");
      const rpeLabel = document.getElementById("rpeLabel");
      const barWeightInput = document.getElementById("barWeightInput");
      const commentsInput = document.getElementById("commentsInput");
      
      // Success Modal
      const bodyWeightSuccessModal = document.getElementById('bodyWeightSuccessModal');
      const closeSuccessModal = document.getElementById('closeSuccessModal');
      
      log(LOG_LEVELS.DEBUG, '🔍 Modal element initialization:');
      log(LOG_LEVELS.DEBUG, `  bodyWeightSuccessModal: ${bodyWeightSuccessModal ? '✅ Found' : '❌ NOT FOUND'}`);
      log(LOG_LEVELS.DEBUG, `  closeSuccessModal: ${closeSuccessModal ? '✅ Found' : '❌ NOT FOUND'}`);
      if (bodyWeightSuccessModal) {
        log(LOG_LEVELS.DEBUG, `  Modal initial classes: "${bodyWeightSuccessModal.className}"`);
      }

      // --- Theme Management ---
      function initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
        log(LOG_LEVELS.INFO, `Theme initialized: ${savedTheme}`);
      }

      // --- Weight Goal Management ---
      function initializeWeightGoal() {
        const savedGoal = localStorage.getItem('weightGoal') || 'cutting';
        weightGoalSelect.value = savedGoal;
        log(LOG_LEVELS.INFO, `Weight goal initialized: ${savedGoal}`);
      }

function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
        log(LOG_LEVELS.INFO, `Theme changed to: ${newTheme}`);
        
        // Redraw chart with new theme colors if it exists AND we're viewing history
        if (chartInstance && chartExerciseSelect.value && !historySection.classList.contains('hidden')) {
          try {
            // The second argument 'true' now correctly signals to skip the loading overlay
            drawChart(chartExerciseSelect.value, true);
          } catch (chartError) {
            log(LOG_LEVELS.ERROR, 'Failed to redraw chart on theme change', chartError);
            // Continue gracefully - theme still changes, chart just won't update
          }
        }
      }

      function updateThemeIcon(theme) {
        themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
        themeToggle.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
      }

      // --- Initialization ---
      function initializeApp() {
        log(LOG_LEVELS.INFO, '========== APPLICATION INITIALIZING ==========');
        log(LOG_LEVELS.INFO, 'Initializing application.');
        initializeTheme();
        initializeWeightGoal();
        
        // Separate try-catch for JSON parsing vs validation
        let rawData = null;
        try {
            rawData = localStorage.getItem("workoutHistory");
            workoutHistory = JSON.parse(rawData || "[]");
            log(LOG_LEVELS.INFO, 'Successfully parsed workoutHistory from localStorage');
        } catch (parseError) {
            logError("JSON parsing failed - localStorage data is corrupted", parseError);
            workoutHistory = [];
            // Clear corrupted data
            try {
              localStorage.setItem("workoutHistory", "[]");
              log(LOG_LEVELS.INFO, 'Cleared corrupted localStorage data');
            } catch (clearError) {
              log(LOG_LEVELS.ERROR, 'Could not clear corrupted data', clearError);
            }
        }
        
        // Validate structure (separate from parsing)
        try {
            // Validate it's an array
            if (!Array.isArray(workoutHistory)) {
              log(LOG_LEVELS.ERROR, 'Corrupted workoutHistory - not an array. Resetting.');
              workoutHistory = [];
              localStorage.setItem("workoutHistory", "[]");
            } else {
              // Validate each entry has required fields
              const validEntries = workoutHistory.filter(entry => {
                if (!entry || typeof entry !== 'object') return false;
                if (!entry.exercise || !entry.date) return false;
                
                // "Other Activity" entries only need exercise, date, and comments
                if (entry.exercise === "Other Activity") {
                  return true; // Already validated exercise and date above
                }
                
                // Regular workout entries need weight, sets, reps
                if (typeof entry.weight !== 'number' || typeof entry.sets !== 'number' || typeof entry.reps !== 'number') return false;
                return true;
              });
              
              if (validEntries.length < workoutHistory.length) {
                log(LOG_LEVELS.WARN, `Filtered out ${workoutHistory.length - validEntries.length} corrupted entries`);
                workoutHistory = validEntries;
              localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));
              }
              
              log(LOG_LEVELS.INFO, `Workout history loaded from localStorage. Total entries: ${workoutHistory.length}`);
            }
        } catch (validationError) {
            logError("Validation failed after parsing", validationError);
            workoutHistory = [];
            localStorage.setItem("workoutHistory", "[]");
        }
        
        const today = new Date().toISOString().split("T")[0];
        dateInput.value = today;
        dateInput.max = today; // Prevent selecting future dates
        activityDateInput.value = today;
        activityDateInput.max = today; // Prevent selecting future dates for activities too
        log(LOG_LEVELS.INFO, `Date inputs set to today: ${today}`);

        renderExercises();
        renderHistory();
        addEventListeners();
        setState("Idle");
        log(LOG_LEVELS.INFO, '========== APPLICATION INITIALIZED ==========');
      }

      // --- State Management ---
      const states = {
        IDLE: 'Idle',
        LOADING: 'Loading',
        EXERCISE_SELECTED: 'ExerciseSelected',
        SAVING: 'Saving',
        VIEWING_HISTORY: 'ViewingHistory',
        ENTRY_DELETED: 'EntryDeleted',
        ALL_DELETED: 'AllDeleted',
        SAVED: 'Saved'
      };
      let currentState = states.IDLE;

      function setState(newState) {
        log(LOG_LEVELS.INFO, `State changed from ${currentState} to ${newState}`);
        currentState = newState;
      }
      
      // --- Loading Functions ---
      function showLoading(message = 'Loading...', duration = 300) {
        log(LOG_LEVELS.INFO, `showLoading() called: "${message}" for ${duration}ms`);
        loadingText.textContent = message;
        loadingOverlay.classList.remove('hidden');
        // Trigger reflow for transition
        loadingOverlay.offsetHeight;
        loadingOverlay.classList.add('show');
        
        return new Promise(resolve => {
          setTimeout(() => {
            hideLoading();
            resolve();
          }, duration);
        });
      }
      
      function hideLoading() {
        log(LOG_LEVELS.INFO, 'hideLoading() called');
        loadingOverlay.classList.remove('show');
        setTimeout(() => {
          loadingOverlay.classList.add('hidden');
        }, 200); // Match transition duration
      }
      
      function setButtonLoading(button, isLoading) {
        log(LOG_LEVELS.INFO, `setButtonLoading() called for button: ${button?.id || 'unknown'}, isLoading: ${isLoading}`);
        if (isLoading) {
          button.classList.add('loading');
          button.disabled = true;
        } else {
          button.classList.remove('loading');
          button.disabled = false;
        }
      }

      // --- Rendering Functions ---
      function renderExercises() {
        log(LOG_LEVELS.INFO, 'Rendering categorized exercises.');
        // Exercises are now hardcoded in HTML, no need to render dynamically
        // This function is kept for potential future use
      }

      function renderPlates() {
        log(LOG_LEVELS.INFO, 'Rendering plates.');
        platesGrid.innerHTML = "";
        plateOrder.forEach(weight => {
          const div = document.createElement("div");
          div.className = "panel";
          div.innerHTML = `
            <div>${weight} lbs</div>
            <div class="plate-controls">
              <button type="button" data-weight="${weight}" data-delta="-1">-</button>
              <span id="plate-${weight}">${plates[weight]}</span>
              <button type="button" data-weight="${weight}" data-delta="1">+</button>
            </div>`;
          platesGrid.appendChild(div);
        });
      }
      
      // --- Input Validation Functions ---
      function validateSetsReps(value) {
        // Integer, max 2 digits (0-99)
        const num = parseInt(value, 10);
        if (isNaN(num)) return 0;
        return Math.max(0, Math.min(99, num));
      }
      
      function validateRPE(value) {
        // Float with 2 decimal places, max 10
        const num = parseFloat(value);
        if (isNaN(num)) return 0;
        const clamped = Math.max(0, Math.min(10, num));
        return Math.round(clamped * 100) / 100; // Round to 2 decimal places
      }
      
      function validateBarWeight(value) {
        // Float with up to 3 digits before decimal
        const num = parseFloat(value);
        if (isNaN(num)) return 45;
        return Math.max(0, Math.min(999, num));
      }
      
      function validateBarWeightInput(value) {
        // Allow empty input during typing
        if (value === '' || value === null || value === undefined) {
          return BAR_WEIGHT; // Return default for empty input
        }
        // Float with up to 3 digits before decimal, allow 0
        const num = parseFloat(value);
        if (isNaN(num)) return BAR_WEIGHT;
        return Math.max(0, Math.min(999, num));
      }
      
      // --- RPE Logarithmic Conversion ---
      // Converts slider position (0-10) to logarithmic RPE value (0-10)
      // Using exponential scale for more granular control at lower RPE values
      function calculateLogarithmicRPE(sliderValue) {
        const position = parseFloat(sliderValue);
        
        // Validate input is a valid number
        if (isNaN(position) || position < 0 || position > 10) {
          log(LOG_LEVELS.WARN, `Invalid RPE slider value: ${sliderValue}, defaulting to 0`);
          return 0;
        }
        
        if (position === 0) return 0;
        
        // Exponential formula: RPE = 10 * (position/10)^2
        // This gives more resolution at lower values
        const rpe = 10 * Math.pow(position / 10, 2);
        const rounded = Math.round(rpe * 100) / 100; // Round to 2 decimal places
        
        // Validate result
        if (isNaN(rounded) || !isFinite(rounded)) {
          log(LOG_LEVELS.ERROR, `RPE calculation produced invalid result: ${rounded}`);
          return 0;
        }
        
        return rounded;
      }
      
      // Expose RPE function to console for testing
      window.calculateLogarithmicRPE = pos => 10 * (pos / 10) ** 2;
      
      // --- Body Weight Tracking Functions ---
      
      // Function to get a random unused message and mark it used
      function getRandomMessage(messages, usedIndices, storageKey) {
        // Validate inputs
        if (!Array.isArray(messages) || messages.length === 0) {
          log(LOG_LEVELS.ERROR, 'Invalid messages array');
          return 'Keep going! 💪'; // Fallback message
        }
        
        if (!Array.isArray(usedIndices)) {
          log(LOG_LEVELS.WARN, 'Invalid usedIndices, resetting');
          usedIndices = [];
        }
        
        if (!storageKey || typeof storageKey !== 'string') {
          log(LOG_LEVELS.ERROR, 'Invalid storageKey');
          return messages[0]; // Return first message as fallback
        }
        
        try {
          // Get available indices (not yet used)
          let availableIndices = messages.map((_, i) => i).filter(i => !usedIndices.includes(i));
          
          if (availableIndices.length === 0) {
            // Reset if all messages have been used
            log(LOG_LEVELS.DEBUG, `All ${messages.length} messages used, resetting ${storageKey}`);
            usedIndices.length = 0; // Clear the array in place (maintains reference)
            localStorage.setItem(storageKey, '[]');
            availableIndices = messages.map((_, i) => i);
          }
          
          // Select random message from available ones
          const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
          usedIndices.push(randomIndex);
          
          // Save updated indices to localStorage
          try {
            localStorage.setItem(storageKey, JSON.stringify(usedIndices));
          } catch (storageError) {
            log(LOG_LEVELS.ERROR, 'Failed to save message tracking to localStorage', storageError);
            // Continue anyway - message will still be shown, just might repeat sooner
          }
          
          log(LOG_LEVELS.DEBUG, `Selected message index ${randomIndex} from ${messages.length} total (${usedIndices.length} used)`);
          return messages[randomIndex];
        } catch (error) {
          log(LOG_LEVELS.ERROR, 'Error selecting random message', error);
          return messages[0]; // Return first message as fallback
        }
      }
      
      // Get last week's most recent body weight entry
      function getLastWeeksBodyWeight(currentDateStr) {
        log(LOG_LEVELS.DEBUG, '=== getLastWeeksBodyWeight() called ===');
        
        // Validate input
        if (!currentDateStr || typeof currentDateStr !== 'string') {
          log(LOG_LEVELS.ERROR, 'Invalid currentDateStr parameter');
          return null;
        }
        
        log(LOG_LEVELS.DEBUG, `Current date: ${currentDateStr}`);
        
        // Validate workoutHistory exists
        if (!Array.isArray(workoutHistory) || workoutHistory.length === 0) {
          log(LOG_LEVELS.DEBUG, 'No workout history available');
          return null;
        }
        
        try {
          // Use parseDateLocal for consistent UTC handling (DST-safe)
          const currentDate = parseDateLocal(currentDateStr);
          
          // Validate date is valid
          if (isNaN(currentDate.getTime())) {
            log(LOG_LEVELS.ERROR, 'Invalid date format');
            return null;
          }
          
          const currentDay = currentDate.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
          const startOfCurrentWeek = new Date(currentDate);
          startOfCurrentWeek.setUTCDate(currentDate.getUTCDate() - currentDay); // Sunday of current week
          const endOfLastWeek = new Date(startOfCurrentWeek);
          endOfLastWeek.setUTCDate(startOfCurrentWeek.getUTCDate() - 1); // Saturday of last week
          const startOfLastWeek = new Date(endOfLastWeek);
          startOfLastWeek.setUTCDate(endOfLastWeek.getUTCDate() - 6); // Sunday of last week
          
          log(LOG_LEVELS.DEBUG, `Last week range: ${startOfLastWeek.toISOString().split('T')[0]} to ${endOfLastWeek.toISOString().split('T')[0]}`);
          
          // Find entries in last week with body weight
          const lastWeekEntries = workoutHistory
            .filter(entry => {
              if (!entry || !entry.date) return false;
              // Use parseDateLocal for DST-safe comparison
              const entryDate = parseDateLocal(entry.date);
              if (isNaN(entryDate.getTime())) return false;
              return entryDate >= startOfLastWeek && 
                     entryDate <= endOfLastWeek && 
                     entry.bodyWeight !== null && 
                     entry.bodyWeight !== undefined && 
                     entry.bodyWeight > 0;
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date)); // Most recent first
          
          const lastWeekWeight = lastWeekEntries.length > 0 ? lastWeekEntries[0].bodyWeight : null;
          log(LOG_LEVELS.DEBUG, `Last week's body weight: ${lastWeekWeight !== null ? `${lastWeekWeight} lbs` : 'None found'}`);
          
          return lastWeekWeight;
        } catch (error) {
          log(LOG_LEVELS.ERROR, 'Error calculating last week body weight', error);
          return null;
        }
      }
      
      // Updated checkBodyWeightProgress - weekly comparison with goal-based feedback
      // Returns: 'positive' if good progress, 'negative' if bad progress, null if no modal shown
      function checkBodyWeightProgress(newBodyWeight, currentDateStr) {
        log(LOG_LEVELS.DEBUG, '=== checkBodyWeightProgress() called ===');
        
        // Validate inputs
        if (newBodyWeight === null || newBodyWeight === undefined || isNaN(newBodyWeight)) {
          log(LOG_LEVELS.ERROR, 'Invalid newBodyWeight parameter');
          return null;
        }
        
        if (!currentDateStr || typeof currentDateStr !== 'string') {
          log(LOG_LEVELS.ERROR, 'Invalid currentDateStr parameter');
          return null;
        }
        
        log(LOG_LEVELS.DEBUG, `New body weight: ${newBodyWeight} lbs`);
        
        try {
          const lastWeekWeight = getLastWeeksBodyWeight(currentDateStr);
          if (lastWeekWeight === null || lastWeekWeight === undefined) {
            log(LOG_LEVELS.DEBUG, 'No previous weekly data - skipping modal');
            return null; // First entry or no last week data - no modal
          }
          
          const difference = newBodyWeight - lastWeekWeight;
          
          // Validate difference is a valid number
          if (isNaN(difference)) {
            log(LOG_LEVELS.ERROR, 'Invalid weight difference calculation');
            return null;
          }
          
          log(LOG_LEVELS.DEBUG, `Difference from last week: ${difference.toFixed(1)} lbs`);
          
          // Calculate overall trend (last 3 weeks average) - DST-safe
          const currentDate = parseDateLocal(currentDateStr);
          const trendStartDate = new Date(currentDate);
          trendStartDate.setUTCDate(currentDate.getUTCDate() - TRACKING_CONFIG.bodyWeight.trendPeriodDays);
          
          const recentWeights = workoutHistory
            .filter(e => {
              if (!e.bodyWeight || e.bodyWeight <= 0 || !e.date) return false;
              const entryDate = parseDateLocal(e.date);
              return entryDate >= trendStartDate && entryDate < currentDate;
            })
            .sort((a, b) => {
              const aDate = parseDateLocal(a.date);
              const bDate = parseDateLocal(b.date);
              return bDate - aDate;
            }); // Recent first
          
          let overallTrend = difference; // Default to single week difference
          if (recentWeights.length >= 2) {
            const mostRecent = recentWeights[0].bodyWeight;
            const oldest = recentWeights[recentWeights.length - 1].bodyWeight;
            overallTrend = (mostRecent - oldest) / recentWeights.length; // Average change per entry
          }
          
          log(LOG_LEVELS.DEBUG, `Overall trend (${TRACKING_CONFIG.bodyWeight.trendPeriodDays} days): ${overallTrend.toFixed(1)} lbs avg`);
          
          const savedGoal = localStorage.getItem('weightGoal') || 'cutting';
          log(LOG_LEVELS.DEBUG, `Current goal mode: ${savedGoal}`);
          
          // Maintenance mode - no feedback
          if (savedGoal === 'maintenance') {
            log(LOG_LEVELS.DEBUG, 'Maintenance mode active - no modal displayed');
            return null;
          }
          
          // Check if change is significant enough
          if (Math.abs(difference) < TRACKING_CONFIG.bodyWeight.weeklyThreshold && 
              Math.abs(overallTrend) < TRACKING_CONFIG.bodyWeight.trendThreshold) {
            log(LOG_LEVELS.DEBUG, 'Insignificant change - no modal');
            return null;
          }
          
          let messageType = null;
          let trendNote = '';
          
          if (savedGoal === 'bulking') {
            // Bulking: Simple - gains good, losses bad
            messageType = difference > 0 ? 'motivational' : 'shame';
            log(LOG_LEVELS.INFO, `Bulking: Weight ${difference > 0 ? 'INCREASE' : 'DECREASE'} - ${messageType} modal`);
          } else { // cutting
            // Cutting: Trend-based - sustained loss is good
            if (overallTrend < -TRACKING_CONFIG.bodyWeight.trendThreshold) {
              // Good trend overrides single weekly uptick
              messageType = 'motivational';
              trendNote = ` (Trend: ↓ ${Math.abs(overallTrend).toFixed(1)} lbs avg - Great progress!)`;
              log(LOG_LEVELS.INFO, 'Cutting: Positive trend - motivational modal');
            } else if (difference > TRACKING_CONFIG.bodyWeight.weeklyThreshold) {
              messageType = 'shame';
              trendNote = overallTrend > 0 ? ` (Trend: ↑ ${Math.abs(overallTrend).toFixed(1)} lbs avg)` : '';
              log(LOG_LEVELS.INFO, 'Cutting: Weight gain - shame modal');
            } else {
              messageType = 'motivational';
              trendNote = ` (Trend: ${overallTrend < 0 ? '↓' : '↑'} ${Math.abs(overallTrend).toFixed(1)} lbs avg)`;
              log(LOG_LEVELS.INFO, 'Cutting: Weight loss - motivational modal');
            }
          }
        } catch (error) {
          log(LOG_LEVELS.ERROR, 'Error in checkBodyWeightProgress', error);
          return null;
        }
        
        if (!messageType) {
          log(LOG_LEVELS.DEBUG, 'No message type determined - no modal');
          return null;
        }
        
        // Get random message (including custom messages)
        const customMessages = JSON.parse(localStorage.getItem(
          messageType === 'shame' ? 'customShameMessages' : 'customMotivationalMessages'
        ) || '[]');
        const allMessages = messageType === 'shame' ? 
          [...SHAME_MESSAGES, ...customMessages] : 
          [...MOTIVATIONAL_MESSAGES, ...customMessages];
        
        const randomMessage = getRandomMessage(
          allMessages,
          messageType === 'shame' ? usedShameIndices : usedMotivationalIndices,
          messageType === 'shame' ? 'usedShameIndices' : 'usedMotivationalIndices'
        );
        
        log(LOG_LEVELS.DEBUG, `Selected message: ${randomMessage}`);
        
        // Update modal content dynamically
        const modal = bodyWeightSuccessModal;
        const modalTitle = modal.querySelector('h3');
        const modalText = modal.querySelector('p');
        const emojiDiv = modal.querySelector('div[style*="font-size"]');
        
        // Set content based on type
        if (messageType === 'shame') {
          emojiDiv.innerHTML = '🐷';
          modalTitle.textContent = 'Oof!';
          modalTitle.style.color = 'var(--red-600)';
          modalText.textContent = randomMessage + (trendNote || '');
          modal.classList.add('shame-modal');
          modal.classList.remove('success-modal');
        } else { // motivational
          emojiDiv.innerHTML = '💪';
          modalTitle.textContent = 'Great Work!';
          modalTitle.style.color = 'var(--emerald-600)';
          modalText.textContent = randomMessage + (trendNote || '');
          modal.classList.add('success-modal');
          modal.classList.remove('shame-modal');
        }
        
        // Show modal with animation
        showBodyWeightModal();
        
        // Return result for gating downstream modals
        return messageType === 'motivational' ? 'positive' : 'negative';
      }
      
      // Show the modal
      function showBodyWeightModal() {
        log(LOG_LEVELS.DEBUG, '=== showBodyWeightModal() called ===');
        log(LOG_LEVELS.DEBUG, `Modal element: ${bodyWeightSuccessModal ? 'Found' : 'NOT FOUND'}`);
        
        if (!bodyWeightSuccessModal) {
          log(LOG_LEVELS.ERROR, 'bodyWeightSuccessModal element is null/undefined!');
          return;
        }
        
        try {
          // Clear any existing timeout to prevent memory leak
          if (modalAutoCloseTimer) {
            clearTimeout(modalAutoCloseTimer);
            log(LOG_LEVELS.DEBUG, 'Cleared previous modal timeout');
          }
          
          log(LOG_LEVELS.DEBUG, `Modal classes BEFORE: "${bodyWeightSuccessModal.className}"`);
          
          bodyWeightSuccessModal.classList.remove('hidden');
          void bodyWeightSuccessModal.offsetWidth; // Trigger reflow
          
          log(LOG_LEVELS.DEBUG, `Modal classes AFTER: "${bodyWeightSuccessModal.className}"`);
          log(LOG_LEVELS.INFO, '✅ Body weight modal displayed');
          
          // Auto-close after 4 seconds
          log(LOG_LEVELS.DEBUG, 'Setting auto-close timer for 4 seconds');
          modalAutoCloseTimer = setTimeout(() => {
            log(LOG_LEVELS.DEBUG, '⏰ Auto-close timer fired (4 seconds elapsed)');
            // Check if timer is still valid (not manually cleared)
            if (modalAutoCloseTimer) {
              modalAutoCloseTimer = null;
              hideBodyWeightModal();
            }
          }, 4000);
        } catch (modalError) {
          log(LOG_LEVELS.ERROR, 'Failed to display modal', modalError);
          // Gracefully fail - modal won't show but app continues
        }
      }
      
      // Hide the modal
      function hideBodyWeightModal() {
        log(LOG_LEVELS.DEBUG, '=== hideBodyWeightModal() called ===');
        log(LOG_LEVELS.DEBUG, `Modal element: ${bodyWeightSuccessModal ? 'Found' : 'NOT FOUND'}`);
        
        if (!bodyWeightSuccessModal) {
          log(LOG_LEVELS.ERROR, 'bodyWeightSuccessModal element is null/undefined!');
          return;
        }
        
        // Clear timeout if modal is being manually closed
        if (modalAutoCloseTimer) {
          clearTimeout(modalAutoCloseTimer);
          modalAutoCloseTimer = null;
          log(LOG_LEVELS.DEBUG, 'Cleared modal auto-close timeout (manual close)');
        }
        
        log(LOG_LEVELS.DEBUG, `Modal classes BEFORE: "${bodyWeightSuccessModal.className}"`);
        
        setTimeout(() => {
          bodyWeightSuccessModal.classList.add('hidden');
          log(LOG_LEVELS.DEBUG, `Modal classes AFTER: "${bodyWeightSuccessModal.className}"`);
          log(LOG_LEVELS.INFO, '❌ Body weight modal hidden');
        }, 200);
      }
      
      // --- Strength Progress Tracking ---
      
      // Get previous best performance for an exercise (based on volume)
      function getPreviousBest(exercise, currentDateStr, currentWeight, currentSets, currentReps) {
        log(LOG_LEVELS.DEBUG, `=== getPreviousBest() for ${exercise} ===`);
        
        // Validate inputs
        if (!exercise || !currentDateStr || currentWeight <= 0 || currentSets <= 0 || currentReps <= 0) {
          log(LOG_LEVELS.DEBUG, 'Invalid parameters for strength check');
          return null;
        }
        
        try {
          // Use UTC for DST-safe date comparisons
          const [y, m, d] = currentDateStr.split('-').map(Number);
          const currentDate = new Date(Date.UTC(y, m - 1, d));
          const lookbackDate = new Date(currentDate);
          lookbackDate.setUTCDate(currentDate.getUTCDate() - TRACKING_CONFIG.strength.lookbackDays);
          
          // Filter past entries for this exercise before today
          const pastEntries = workoutHistory
            .filter(entry => {
              if (!entry.exercise || entry.exercise !== exercise || !entry.date) return false;
              if (entry.weight <= 0 || entry.sets <= 0 || entry.reps <= 0) return false;
              
              const [ey, em, ed] = entry.date.split('-').map(Number);
              const entryDate = new Date(Date.UTC(ey, em - 1, ed));
              return entryDate < currentDate && entryDate >= lookbackDate;
            })
            .sort((a, b) => {
              const [ay, am, ad] = a.date.split('-').map(Number);
              const [by, bm, bd] = b.date.split('-').map(Number);
              return new Date(Date.UTC(by, bm - 1, bd)) - new Date(Date.UTC(ay, am - 1, ad));
            }) // Recent first
            .slice(0, 3); // Last 3 sessions for trend
          
          if (pastEntries.length < TRACKING_CONFIG.strength.minSessions) {
            log(LOG_LEVELS.DEBUG, `Insufficient previous data (${pastEntries.length} sessions) - no strength feedback`);
            return null;
          }
          
          // Calculate "best" as max volume (weight * sets * reps) from past
          const pastVolumes = pastEntries.map(e => e.weight * e.sets * e.reps);
          const previousBestVolume = Math.max(...pastVolumes);
          const previousBestEntry = pastEntries.find(e => e.weight * e.sets * e.reps === previousBestVolume);
          
          // Current volume
          const currentVolume = currentWeight * currentSets * currentReps;
          
          log(LOG_LEVELS.DEBUG, `Past sessions: ${pastEntries.length}, Previous best volume: ${previousBestVolume}, Current volume: ${currentVolume}`);
          
          return { 
            previousBestVolume, 
            currentVolume, 
            trend: currentVolume > previousBestVolume ? 'stronger' : 'weaker',
            previousBestEntry
          };
        } catch (error) {
          log(LOG_LEVELS.ERROR, 'Error in getPreviousBest', error);
          return null;
        }
      }
      
      // Check strength progress and show modal if appropriate
      function checkStrengthProgress(exercise, weight, sets, reps, dateStr) {
        log(LOG_LEVELS.DEBUG, '=== checkStrengthProgress() called ===');
        
        // Comprehensive validation
        if (!exercise || exercise === "Other Activity") {
          log(LOG_LEVELS.DEBUG, 'Invalid exercise - skipping strength check');
          return;
        }
        
        if (typeof weight !== 'number' || weight <= 0 || isNaN(weight)) {
          log(LOG_LEVELS.DEBUG, 'Invalid weight - skipping strength check');
          return;
        }
        
        if (typeof sets !== 'number' || sets <= 0 || isNaN(sets)) {
          log(LOG_LEVELS.DEBUG, 'Invalid sets - skipping strength check');
          return;
        }
        
        if (typeof reps !== 'number' || reps <= 0 || isNaN(reps)) {
          log(LOG_LEVELS.DEBUG, 'Invalid reps - skipping strength check');
          return;
        }
        
        if (!dateStr || typeof dateStr !== 'string') {
          log(LOG_LEVELS.DEBUG, 'Invalid date - skipping strength check');
          return;
        }
        
        try {
          const prevBest = getPreviousBest(exercise, dateStr, weight, sets, reps);
          if (!prevBest) return;
          
          const { trend, currentVolume, previousBestVolume } = prevBest;
          
          // Validate returned values
          if (!trend || isNaN(currentVolume) || isNaN(previousBestVolume)) {
            log(LOG_LEVELS.ERROR, 'Invalid data returned from getPreviousBest');
            return;
          }
          
          const messageType = trend === 'stronger' ? 'strength-motivational' : 'strength-shame';
          
          // Get custom messages
          const customMessages = JSON.parse(localStorage.getItem(
            messageType === 'strength-motivational' ? 'customStrengthMotivationalMessages' : 'customStrengthShameMessages'
          ) || '[]');
          const allMessages = messageType === 'strength-motivational' ? 
            [...STRENGTH_MOTIVATIONAL, ...customMessages] : 
            [...STRENGTH_SHAME, ...customMessages];
          
          const randomMessage = getRandomMessage(
            allMessages,
            messageType === 'strength-motivational' ? usedStrengthMotivationalIndices : usedStrengthShameIndices,
            messageType === 'strength-motivational' ? 'usedStrengthMotivationalIndices' : 'usedStrengthShameIndices'
          );
          
          log(LOG_LEVELS.INFO, `Strength ${trend}: ${exercise}, Volume ${currentVolume} vs ${previousBestVolume}`);
          
          // Show strength modal (reuse body weight modal with different styling)
          const modal = bodyWeightSuccessModal;
          if (!modal) {
            log(LOG_LEVELS.ERROR, 'Modal element not found - cannot show strength feedback');
            return;
          }
          
          const emojiDiv = modal.querySelector('div[style*="font-size"]');
          const modalTitle = modal.querySelector('h3');
          const modalText = modal.querySelector('p');
          
          if (!emojiDiv || !modalTitle || !modalText) {
            log(LOG_LEVELS.ERROR, 'Modal child elements not found - cannot show strength feedback');
            return;
          }
          
          emojiDiv.innerHTML = trend === 'stronger' ? '💪' : '😤';
          modalTitle.textContent = 'Strength Update!';
          modalTitle.style.color = trend === 'stronger' ? 'var(--emerald-600)' : 'var(--amber-600)';
          modalText.textContent = `${randomMessage}\nVolume: ${currentVolume.toFixed(0)} vs Previous Best: ${previousBestVolume.toFixed(0)}`;
          
          modal.classList.remove('shame-modal', 'success-modal');
          modal.classList.add(trend === 'stronger' ? 'success-modal' : 'strength-neutral-modal');
          
          showBodyWeightModal();
        } catch (strengthError) {
          log(LOG_LEVELS.ERROR, 'Error in checkStrengthProgress', strengthError);
          // Gracefully fail - don't crash the app
        }
      }
      
      // --- Settings & Message Management ---
      
      function renderMessagesList() {
        log(LOG_LEVELS.DEBUG, 'Rendering messages lists');
        
        // Load custom messages from localStorage
        const customMotivational = JSON.parse(localStorage.getItem('customMotivationalMessages') || '[]');
        const customShame = JSON.parse(localStorage.getItem('customShameMessages') || '[]');
        
        // Render Motivational Messages
        motivationalMessagesList.innerHTML = '';
        const allMotivational = [...MOTIVATIONAL_MESSAGES, ...customMotivational];
        allMotivational.forEach((msg, index) => {
          const isCustom = index >= MOTIVATIONAL_MESSAGES.length;
          const item = document.createElement('div');
          item.className = 'message-item';
          item.innerHTML = `
            <span class="message-text">${msg}</span>
            <div class="message-actions">
              ${isCustom ? `<button class="message-delete" data-type="motivational" data-index="${index - MOTIVATIONAL_MESSAGES.length}">Delete</button>` : '<span style="font-size: var(--font-size-xs); color: var(--text-secondary);">Default</span>'}
            </div>
          `;
          motivationalMessagesList.appendChild(item);
        });
        
        // Render Shame Messages
        shameMessagesList.innerHTML = '';
        const allShame = [...SHAME_MESSAGES, ...customShame];
        allShame.forEach((msg, index) => {
          const isCustom = index >= SHAME_MESSAGES.length;
          const item = document.createElement('div');
          item.className = 'message-item';
          item.innerHTML = `
            <span class="message-text">${msg}</span>
            <div class="message-actions">
              ${isCustom ? `<button class="message-delete" data-type="shame" data-index="${index - SHAME_MESSAGES.length}">Delete</button>` : '<span style="font-size: var(--font-size-xs); color: var(--text-secondary);">Default</span>'}
            </div>
          `;
          shameMessagesList.appendChild(item);
        });
        
        // Render Strength Motivational Messages
        const customStrengthMotivational = JSON.parse(localStorage.getItem('customStrengthMotivationalMessages') || '[]');
        strengthMotivationalMessagesList.innerHTML = '';
        const allStrengthMotivational = [...STRENGTH_MOTIVATIONAL, ...customStrengthMotivational];
        allStrengthMotivational.forEach((msg, index) => {
          const isCustom = index >= STRENGTH_MOTIVATIONAL.length;
          const item = document.createElement('div');
          item.className = 'message-item';
          item.innerHTML = `
            <span class="message-text">${msg}</span>
            <div class="message-actions">
              ${isCustom ? `<button class="message-delete" data-type="strength-motivational" data-index="${index - STRENGTH_MOTIVATIONAL.length}">Delete</button>` : '<span style="font-size: var(--font-size-xs); color: var(--text-secondary);">Default</span>'}
            </div>
          `;
          strengthMotivationalMessagesList.appendChild(item);
        });
        
        // Render Strength Shame Messages
        const customStrengthShame = JSON.parse(localStorage.getItem('customStrengthShameMessages') || '[]');
        strengthShameMessagesList.innerHTML = '';
        const allStrengthShame = [...STRENGTH_SHAME, ...customStrengthShame];
        allStrengthShame.forEach((msg, index) => {
          const isCustom = index >= STRENGTH_SHAME.length;
          const item = document.createElement('div');
          item.className = 'message-item';
          item.innerHTML = `
            <span class="message-text">${msg}</span>
            <div class="message-actions">
              ${isCustom ? `<button class="message-delete" data-type="strength-shame" data-index="${index - STRENGTH_SHAME.length}">Delete</button>` : '<span style="font-size: var(--font-size-xs); color: var(--text-secondary);">Default</span>'}
            </div>
          `;
          strengthShameMessagesList.appendChild(item);
        });
        
        log(LOG_LEVELS.INFO, `Rendered ${allMotivational.length} motivational, ${allShame.length} shame, ${allStrengthMotivational.length} strength motivational, and ${allStrengthShame.length} strength shame messages`);
      }
      
      function addCustomMessage(type) {
        let input, storageKey;
        
        switch(type) {
          case 'motivational':
            input = newMotivationalMessage;
            storageKey = 'customMotivationalMessages';
            break;
          case 'shame':
            input = newShameMessage;
            storageKey = 'customShameMessages';
            break;
          case 'strength-motivational':
            input = newStrengthMotivationalMessage;
            storageKey = 'customStrengthMotivationalMessages';
            break;
          case 'strength-shame':
            input = newStrengthShameMessage;
            storageKey = 'customStrengthShameMessages';
            break;
          default:
            log(LOG_LEVELS.ERROR, `Invalid message type: ${type}`);
            return;
        }
        
        const message = input.value.trim();
        
        if (!message) {
          alert('Please enter a message!');
          return;
        }
        
        const customMessages = JSON.parse(localStorage.getItem(storageKey) || '[]');
        
        customMessages.push(message);
        localStorage.setItem(storageKey, JSON.stringify(customMessages));
        
        input.value = '';
        renderMessagesList();
        log(LOG_LEVELS.INFO, `Added custom ${type} message: ${message}`);
      }
      
      function deleteCustomMessage(type, index) {
        let storageKey;
        
        switch(type) {
          case 'motivational':
            storageKey = 'customMotivationalMessages';
            break;
          case 'shame':
            storageKey = 'customShameMessages';
            break;
          case 'strength-motivational':
            storageKey = 'customStrengthMotivationalMessages';
            break;
          case 'strength-shame':
            storageKey = 'customStrengthShameMessages';
            break;
          default:
            log(LOG_LEVELS.ERROR, `Invalid message type: ${type}`);
            return;
        }
        
        const customMessages = JSON.parse(localStorage.getItem(storageKey) || '[]');
        
        if (index >= 0 && index < customMessages.length) {
          const deleted = customMessages.splice(index, 1);
          localStorage.setItem(storageKey, JSON.stringify(customMessages));
          renderMessagesList();
          log(LOG_LEVELS.INFO, `Deleted custom ${type} message: ${deleted[0]}`);
        }
      }
      
      function resetMessagesToDefaults() {
        if (confirm('Reset all custom messages to defaults? This will delete all custom messages.')) {
          localStorage.removeItem('customMotivationalMessages');
          localStorage.removeItem('customShameMessages');
          localStorage.removeItem('customStrengthMotivationalMessages');
          localStorage.removeItem('customStrengthShameMessages');
          renderMessagesList();
          log(LOG_LEVELS.INFO, 'Reset messages to defaults');
          alert('Messages reset to defaults!');
        }
      }
      
      function clearMessageTrackingHistory() {
        if (confirm('Clear message usage history? This will allow all messages to show again.')) {
          // Clear localStorage first
          localStorage.removeItem('usedShameIndices');
          localStorage.removeItem('usedMotivationalIndices');
          localStorage.removeItem('usedStrengthMotivationalIndices');
          localStorage.removeItem('usedStrengthShameIndices');
          
          // Create NEW arrays (don't mutate existing ones)
          usedShameIndices = [];
          usedMotivationalIndices = [];
          usedStrengthMotivationalIndices = [];
          usedStrengthShameIndices = [];
          
          // Immediately save empty arrays to localStorage to prevent race conditions
          localStorage.setItem('usedShameIndices', '[]');
          localStorage.setItem('usedMotivationalIndices', '[]');
          localStorage.setItem('usedStrengthMotivationalIndices', '[]');
          localStorage.setItem('usedStrengthShameIndices', '[]');
          
          log(LOG_LEVELS.INFO, 'Cleared message tracking history and reset arrays');
          alert('Message history cleared! All messages can now appear again.');
        }
      }
      
      function toggleSettingsSection() {
        const isHidden = settingsSection.classList.contains('hidden');
        settingsSection.classList.toggle('hidden');
        log(LOG_LEVELS.INFO, isHidden ? 'Settings section opened' : 'Settings section closed');
        
        if (isHidden) {
          renderMessagesList();
          settingsSection.scrollIntoView({ behavior: 'smooth' });
        }
      }
      
      // --- Week Calculation Functions ---
      function parseDateLocal(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') {
          throw new Error('Invalid date string provided');
        }
        
        const parts = dateStr.split('-');
        if (parts.length !== 3) {
          throw new Error('Date string must be in YYYY-MM-DD format');
        }
        
        const [y, m, d] = parts.map(Number);
        
        // Validate each component is a valid number
        if (isNaN(y) || isNaN(m) || isNaN(d)) {
          throw new Error('Date components must be valid numbers');
        }
        
        // Validate ranges
        if (y < 1900 || y > 2100) {
          throw new Error('Year must be between 1900 and 2100');
        }
        if (m < 1 || m > 12) {
          throw new Error('Month must be between 1 and 12');
        }
        if (d < 1 || d > 31) {
          throw new Error('Day must be between 1 and 31');
        }
        
        // Use UTC for consistent date handling across timezones
        const date = new Date(Date.UTC(y, m - 1, d));
        
        // Validate the date is actually valid (catches Feb 30, etc.)
        if (isNaN(date.getTime()) || 
            date.getUTCFullYear() !== y || 
            date.getUTCMonth() !== m - 1 || 
            date.getUTCDate() !== d) {
          throw new Error('Invalid date (e.g., Feb 30)');
        }
        
        return date;
      }
      
function getWeekBounds(offset = 0) {
        log(LOG_LEVELS.INFO, `Getting week bounds for offset: ${offset}`);
        const now = new Date();
        const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        
        // Calculate the start of the current week (Sunday)
        const currentWeekStart = new Date(today);
        currentWeekStart.setUTCDate(today.getUTCDate() - today.getUTCDay());
        
        // Apply offset (negative for past weeks, positive for future)
        const weekStart = new Date(currentWeekStart);
        weekStart.setUTCDate(currentWeekStart.getUTCDate() + (offset * 7));
        
        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
        
        log(LOG_LEVELS.INFO, `Week bounds calculated:`, { start: weekStart, end: weekEnd });
        return { start: weekStart, end: weekEnd };
      }
      
      function formatDateRange(start, end) {
        const options = { month: 'short', day: 'numeric', year: 'numeric' };
        return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
      }
      
      function isDateInRange(dateStr, start, end) {
        try {
          const date = parseDateLocal(dateStr);
          return date >= start && date <= end;
        } catch (dateError) {
          log(LOG_LEVELS.ERROR, `Invalid date in range check: ${dateStr}`, dateError);
          return false;
        }
      }
      
      function getWeekWorkouts(offset = 0) {
        const { start, end } = getWeekBounds(offset);
        return workoutHistory.filter(entry => isDateInRange(entry.date, start, end));
      }
      
      function calculateWeekStats(workouts) {
        log(LOG_LEVELS.INFO, 'Calculating week statistics.');
        
        // Filter out activity logs to get accurate workout stats
        const actualWorkouts = workouts.filter(w => w.exercise !== "Other Activity");
        
        if (actualWorkouts.length === 0) {
          log(LOG_LEVELS.INFO, 'No actual workouts found for stats calculation.');
          return {
            totalWorkouts: 0,
            totalVolume: 0,
            avgRPE: 0,
            uniqueExercises: 0
          };
        }
        
        const totalVolume = actualWorkouts.reduce((sum, w) => sum + (w.weight * w.sets * w.reps), 0);
        const avgRPE = actualWorkouts.reduce((sum, w) => sum + w.rpe, 0) / actualWorkouts.length;
        const uniqueExercises = new Set(actualWorkouts.map(w => w.exercise)).size;
        
        const stats = {
          totalWorkouts: actualWorkouts.length,
          totalVolume: Math.round(totalVolume),
          avgRPE: Number(avgRPE.toFixed(1)),
          uniqueExercises
        };
        
        log(LOG_LEVELS.INFO, 'Week stats calculated:', stats);
        return stats;
      }

      function renderHistory() {
        log(LOG_LEVELS.INFO, 'Rendering history.');
        
        // Update week range display
        const { start, end } = getWeekBounds(currentWeekOffset);
        weekRangeEl.textContent = formatDateRange(start, end);
        
        // Enable/disable navigation buttons (prevent navigating to future weeks)
        nextWeekBtn.disabled = currentWeekOffset >= 0;
        
        // Disable export button if no data
        const exportButton = document.getElementById('exportCSV');
        if (exportButton) {
          exportButton.disabled = !workoutHistory.length;
        }
        
        // Get workouts for current week view
        const weekWorkouts = getWeekWorkouts(currentWeekOffset);
        
        // Calculate and display stats
        const stats = calculateWeekStats(weekWorkouts);
        weekStatsEl.innerHTML = `
          <div class="stat-item">
            <div class="stat-value">${stats.totalWorkouts}</div>
            <div class="stat-label">Workouts</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats.totalVolume.toLocaleString()}</div>
            <div class="stat-label">Total Volume (lbs)</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats.avgRPE}</div>
            <div class="stat-label">Avg RPE</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats.uniqueExercises}</div>
            <div class="stat-label">Exercises</div>
          </div>
        `;
        
        // Render workout entries for the week
        historyList.innerHTML = "";
        if (weekWorkouts.length === 0) {
          historyList.innerHTML = `<p class="muted">No workouts this week.</p>`;
          return;
        }
        
        weekWorkouts.slice().reverse().forEach(entry => {
            const div = document.createElement("div");
            div.className = "history-entry";
            
            // Get category for color coding
            const category = getExerciseCategory(entry.exercise);
            let borderColor = 'var(--accent-primary)'; // Default blue
            
            if (category === 'Push') {
              borderColor = 'var(--emerald-600)'; // Green for push
            } else if (category === 'Pull') {
              borderColor = 'var(--amber-500)'; // Orange for pull
            } else if (category === 'Legs') {
              borderColor = 'var(--red-600)'; // Red for legs
            } else if (entry.exercise === "Other Activity") {
              borderColor = 'var(--cyan-600)'; // Cyan for activity logs
            }
            
            div.style.borderLeftColor = borderColor;
            
            // Check if it's an activity log (no weight/sets/reps)
            if (entry.exercise === "Other Activity") {
              const dateObj = parseDateLocal(entry.date);
              const formattedDate = dateObj.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
              });
              const bodyWeightDisplay = entry.bodyWeight ? `<br><small style="color: var(--text-secondary);">Body Weight: ${entry.bodyWeight} lbs</small>` : '';
              const editedBadge = entry.edited ? `<span style="font-size: 0.7rem; color: var(--text-secondary); margin-left: 5px;">(edited)</span>` : '';
              
              div.innerHTML = `
                <div>
                  <strong>Activity Log</strong>${editedBadge}<br>
                  <small>${formattedDate}</small>${bodyWeightDisplay}<br>
                  <small style="color: var(--text-secondary); font-style: italic;">${entry.comments}</small>
                </div>
                <div style="display: flex; gap: 5px;">
                  <button class="edit-btn" data-id="${entry.id}" title="Edit">✏️</button>
                  <button class="delete-btn" data-id="${entry.id}" title="Delete">🗑️</button>
                </div>
              `;
            } else {
              const dateObj = parseDateLocal(entry.date);
              const formattedDate = dateObj.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
              });
              const commentsDisplay = entry.comments ? `<br><small style="color: var(--text-secondary); font-style: italic;">💬 ${entry.comments}</small>` : '';
              const bodyWeightDisplay = entry.bodyWeight ? `<br><small style="color: var(--text-secondary);">Body Weight: ${entry.bodyWeight} lbs</small>` : '';
              const categoryBadge = category ? `<span style="font-size: 0.75rem; color: ${borderColor}; font-weight: 600;">[${category.toUpperCase()}]</span> ` : '';
              div.innerHTML = `
                <div>
                  ${categoryBadge}<strong>${entry.exercise}</strong><br>
                  <small>${formattedDate} | ${entry.weight} lbs × ${entry.sets}x${entry.reps} @ RPE ${entry.rpe}</small>${bodyWeightDisplay}${commentsDisplay}
                </div>
                <button class="delete-btn" data-id="${entry.id}">🗑️</button>
              `;
            }
            
            historyList.appendChild(div);
        });
      }
      
      // --- Core Logic ---
      function selectExercise(ex) {
        log(LOG_LEVELS.INFO, `Exercise selected: ${ex}`);
        showLoading('Loading exercise...', 400).then(() => {
          currentExercise = ex;
          selectedExerciseEl.textContent = ex;
          workoutForm.classList.remove("hidden");
          exerciseSection.classList.add("hidden");
          activityLogSection.classList.add("hidden");
          renderPlates();
          updateTotalWeight();
          setState(states.EXERCISE_SELECTED);
        });
      }
      
      function changePlate(weight, delta) {
          const key = String(weight);
          // Limit plates to reasonable maximum (20 per weight)
          const newCount = Math.max(0, Math.min(20, plates[key] + delta));
          
          if (newCount === 20 && delta > 0) {
            log(LOG_LEVELS.WARN, `Maximum plate count reached for ${weight} lbs plates`);
          }
          
          plates[key] = newCount;
          log(LOG_LEVELS.INFO, `Plate changed: weight=${weight}, delta=${delta}, newCount=${plates[key]}`);
          document.getElementById(`plate-${key}`).textContent = plates[key];
          updateTotalWeight();
      }

      function calculateTotalWeight() {
        const plateWeight = Object.entries(plates).reduce((sum, [w, c]) => sum + parseFloat(w) * c * 2, 0);
        const inputValue = barWeightInput.value.trim();
        const barWeight = inputValue === '' ? BAR_WEIGHT : (parseFloat(inputValue) || BAR_WEIGHT);
        const totalWeight = barWeight + plateWeight;
        
        // Safety check for unrealistic weights
        if (totalWeight > 2000) {
          log(LOG_LEVELS.WARN, `Warning: Total weight ${totalWeight} lbs exceeds safe limit`);
        }
        
        return totalWeight;
      }

      function updateTotalWeight() {
        const newWeight = calculateTotalWeight();
        log(LOG_LEVELS.INFO, `Total weight updated to: ${newWeight} lbs`);
        totalWeightEl.textContent = newWeight + " lbs";
        
        // Add pulse animation
        totalWeightEl.classList.remove('updated');
        void totalWeightEl.offsetWidth; // Trigger reflow
        totalWeightEl.classList.add('updated');
        setTimeout(() => totalWeightEl.classList.remove('updated'), 500);
      }

      // --- Body Weight Validation Helper (DRY Principle) ---
      function validateAndGetBodyWeight(checkbox, input) {
        if (!checkbox.checked) {
          return null; // Not logging body weight, so return null
        }
        
        const rawValue = input.value.trim();
        if (!rawValue) {
          log(LOG_LEVELS.WARN, 'Validation failed: Body weight field is empty.');
          alert("Please enter your body weight.");
          return { error: true };
        }
        
        // Prevent scientific notation and non-numeric strings
        if (!/^\d+\.?\d*$/.test(rawValue)) {
          log(LOG_LEVELS.WARN, `Validation failed: Invalid body weight format: "${rawValue}"`);
          alert("Please enter a valid numeric body weight (no scientific notation).");
          return { error: true };
        }
        
        const bodyWeight = parseFloat(rawValue);
        if (isNaN(bodyWeight) || !isFinite(bodyWeight)) {
          log(LOG_LEVELS.WARN, `Validation failed: Invalid body weight value: "${rawValue}"`);
          alert("Please enter a valid numeric body weight.");
          return { error: true };
        }
        
        if (bodyWeight < 50 || bodyWeight > 500) {
          log(LOG_LEVELS.WARN, `Validation failed: Body weight out of range: ${bodyWeight} lbs`);
          alert("Please enter a body weight between 50 and 500 lbs.");
          return { error: true };
        }
        
        log(LOG_LEVELS.INFO, `Body weight validated: ${bodyWeight} lbs`);
        return { bodyWeight }; // Return a valid body weight
      }

      function saveWorkout() {
        log(LOG_LEVELS.INFO, 'saveWorkout() called');
        const saveButton = document.getElementById("saveWorkout");
        
        // Prevent concurrent operations
        if (operationInProgress) {
          log(LOG_LEVELS.WARN, 'Operation already in progress, ignoring save request');
          return;
        }
        
        // Helper to ensure operationInProgress is always reset
        const finishOperation = () => {
          setButtonLoading(saveButton, false);
          operationInProgress = false;
          log(LOG_LEVELS.DEBUG, 'Operation finished, flag reset');
        };
        
        setButtonLoading(saveButton, true);
        operationInProgress = true; // Prevent page close during save
        
        setTimeout(() => {
          try {
            // Use input values (which are synced with sliders)
            const sets = parseInt(setsInput.value, 10);
            const reps = parseInt(repsInput.value, 10);
            const rpe = parseFloat(rpeInput.value); // Use the input value directly (already calculated)
            const date = dateInput.value;
            const weight = calculateTotalWeight();
            const comments = commentsInput.value.trim();

            if (!currentExercise) {
              log(LOG_LEVELS.WARN, 'Save attempt failed: No exercise selected.');
              alert("Please select an exercise.");
              finishOperation();
              return;
            }
            
            // Validate date is not in the future
            if (new Date(date) > new Date()) {
              log(LOG_LEVELS.WARN, 'Save attempt failed: Future date selected.');
              alert("Cannot save workouts for future dates.");
              finishOperation();
              return;
            }
            
            // Validate body weight using DRY helper
            const bodyWeightValidation = validateAndGetBodyWeight(workoutIncludeBodyWeightCheckbox, workoutBodyWeightInput);
            if (bodyWeightValidation && bodyWeightValidation.error) {
              finishOperation();
              return; // Stop if validation failed
            }
            const bodyWeight = bodyWeightValidation ? bodyWeightValidation.bodyWeight : null;

            const entry = { id: Date.now(), exercise: currentExercise, weight, sets, reps, rpe, date, comments, bodyWeight };
            log(LOG_LEVELS.INFO, 'Saving workout.', entry);
            workoutHistory.push(entry);
            
            try {
              if (!safeSetItem("workoutHistory", JSON.stringify(workoutHistory))) {
                workoutHistory.pop(); // Rollback
                finishOperation();
                return;
              }
              log(LOG_LEVELS.INFO, 'Workout saved to localStorage successfully');
            } catch (storageError) {
              log(LOG_LEVELS.ERROR, 'LocalStorage quota exceeded or unavailable', storageError);
              alert("Failed to save workout. Storage may be full. Consider exporting your data.");
              workoutHistory.pop(); // Rollback
              finishOperation();
              return;
            }
            
            // Check for body weight progress (wrapped in try-catch to prevent crashes)
            let bodyWeightResult = null;
            if (bodyWeight) {
              try {
                bodyWeightResult = checkBodyWeightProgress(bodyWeight, date);
              } catch (progressError) {
                log(LOG_LEVELS.ERROR, 'Body weight progress check failed - continuing without modal', progressError);
                // Continue gracefully - don't block workout save
              }
            }
            
            // Check for strength progress - always runs regardless of body weight result
            // A strength gain is always a win!
            try {
              log(LOG_LEVELS.DEBUG, 'Checking strength progress...');
              checkStrengthProgress(currentExercise, weight, sets, reps, date);
            } catch (strengthError) {
              log(LOG_LEVELS.ERROR, 'Strength progress check failed - continuing without modal', strengthError);
              // Continue gracefully
            }

            showLoading('Saving workout...', 600).then(() => {
              renderHistory();
              cancelWorkout();
              setState(states.SAVED);
              finishOperation(); // Safe to close page now
            }).catch((loadingError) => {
              log(LOG_LEVELS.ERROR, 'Error during post-save operations', loadingError);
              finishOperation();
            });
          } catch (e) {
            logError("Failed to save workout", e);
            alert("An unexpected error occurred. Your workout may not have been saved.");
            finishOperation();
          }
        }, 100);
      }

      function saveActivity() {
        log(LOG_LEVELS.INFO, 'saveActivity() called');
        const saveButton = document.getElementById("saveActivity");
        
        // Prevent concurrent operations
        if (operationInProgress) {
          log(LOG_LEVELS.WARN, 'Operation already in progress, ignoring save request');
          return;
        }
        
        // Helper to ensure operationInProgress is always reset
        const finishOperation = () => {
          setButtonLoading(saveButton, false);
          operationInProgress = false;
          log(LOG_LEVELS.DEBUG, 'Activity operation finished, flag reset');
        };
        
        setButtonLoading(saveButton, true);
        operationInProgress = true;
        
        setTimeout(() => {
          try {
            const activity = activityInput.value.trim();
            const date = activityDateInput.value;
            const editingId = activityInput.dataset.editingId;
            const isEditing = !!editingId;
            
            // OR gate: Allow activity OR body weight OR both
            if (!activity && !includeBodyWeightCheckbox.checked) {
              log(LOG_LEVELS.WARN, 'Save activity failed: No activity or body weight entered.');
              alert("Please enter an activity note or log your body weight.");
              finishOperation();
              return;
            }
            
            if (new Date(date) > new Date()) {
              log(LOG_LEVELS.WARN, 'Save activity failed: Future date selected.');
              alert("Cannot log activities for future dates.");
              finishOperation();
              return;
            }
            
            // Validate body weight using DRY helper
            const bodyWeightValidation = validateAndGetBodyWeight(includeBodyWeightCheckbox, bodyWeightInput);
            if (bodyWeightValidation && bodyWeightValidation.error) {
              finishOperation();
              return; // Stop if validation failed
            }
            const bodyWeight = bodyWeightValidation ? bodyWeightValidation.bodyWeight : null;
            
            if (isEditing) {
              // Update existing entry
              const entryIndex = workoutHistory.findIndex(e => e.id === parseInt(editingId, 10));
              if (entryIndex !== -1) {
                workoutHistory[entryIndex].comments = activity || "Body weight check-in";
                workoutHistory[entryIndex].date = date;
                workoutHistory[entryIndex].bodyWeight = bodyWeight;
                workoutHistory[entryIndex].edited = true;
                log(LOG_LEVELS.INFO, 'Updating activity log.', workoutHistory[entryIndex]);
              }
            } else {
              // Create new entry
              const entry = { 
                id: Date.now(), 
                exercise: "Other Activity", 
                weight: 0, 
                sets: 0, 
                reps: 0, 
                rpe: 0, 
                date, 
                comments: activity || "Body weight check-in",
                bodyWeight,
                edited: false
              };
              
              log(LOG_LEVELS.INFO, 'Saving new activity log.', entry);
              workoutHistory.push(entry);
            }
            
            try {
              if (!safeSetItem("workoutHistory", JSON.stringify(workoutHistory))) {
                if (!isEditing) workoutHistory.pop(); // Rollback only if new entry
                finishOperation();
                return;
              }
              log(LOG_LEVELS.INFO, 'Activity saved to localStorage successfully');
            } catch (storageError) {
              log(LOG_LEVELS.ERROR, 'LocalStorage quota exceeded or unavailable', storageError);
              alert("Failed to save activity. Storage may be full. Consider exporting your data.");
              if (!isEditing) workoutHistory.pop(); // Rollback only if new entry
              finishOperation();
              return;
            }
            
            // Check for body weight progress
            if (bodyWeight && !isEditing) {
              checkBodyWeightProgress(bodyWeight, date);
            }
            
            showLoading(isEditing ? 'Updating activity...' : 'Logging activity...', 600).then(() => {
              renderHistory();
              activityInput.value = "";
              bodyWeightInput.value = "";
              includeBodyWeightCheckbox.checked = false;
              bodyWeightInputDiv.classList.add('hidden');
              const today = new Date().toISOString().split("T")[0];
              activityDateInput.value = today;
              delete activityInput.dataset.editingId;
              saveButton.textContent = "Save Entry";
              setState(states.SAVED);
              finishOperation();
            });
          } catch (e) {
            logError("Failed to save activity", e);
            finishOperation();
          }
        }, 100);
      }

      // Helper function to clear activity edit state
      function clearActivityEditState() {
        if (activityInput.dataset.editingId) {
          delete activityInput.dataset.editingId;
          const saveButton = document.getElementById("saveActivity");
          saveButton.textContent = "Save Entry";
          log(LOG_LEVELS.DEBUG, 'Cleared activity edit state');
        }
      }

      function cancelWorkout() {
        log(LOG_LEVELS.INFO, 'cancelWorkout() called - Workout cancelled.');
        for (let key in plates) plates[key] = 0;
        
        // Reset all inputs
        commentsInput.value = "";
        workoutBodyWeightInput.value = "";
        workoutIncludeBodyWeightCheckbox.checked = false;
        workoutBodyWeightInputDiv.classList.add('hidden');
        
        // Reset bar weight to default
        barWeightInput.value = 45;
        
        // Reset sliders and inputs to 0
        setsRange.value = 0;
        setsInput.value = 0;
        setsLabel.textContent = "Sets: 0";
        
        repsRange.value = 0;
        repsInput.value = 0;
        repsLabel.textContent = "Reps: 0";
        
        rpeRange.value = 0;
        rpeInput.value = 0;
        rpeLabel.textContent = "RPE: 0";
        
        renderPlates();
        updateTotalWeight();
        workoutForm.classList.add("hidden");
        exerciseSection.classList.remove("hidden");
        activityLogSection.classList.remove("hidden");
        currentExercise = "";
        // Reset all dropdowns
        pushSelect.value = "";
        pullSelect.value = "";
        legsSelect.value = "";
        setState(states.IDLE);
        log(LOG_LEVELS.INFO, 'Workout form reset complete');
      }

      function editActivity(id) {
        const entryId = parseInt(id, 10);
        log(LOG_LEVELS.INFO, `editActivity() called with ID: ${entryId}`);
        
        // Validate ID
        if (isNaN(entryId)) {
          log(LOG_LEVELS.ERROR, `Invalid entry ID: ${id}`);
          alert('Invalid entry ID. Cannot edit.');
          return;
        }
        
        const entry = workoutHistory.find(e => e.id === entryId);
        if (!entry) {
          log(LOG_LEVELS.ERROR, `Entry not found with ID: ${entryId}`);
          alert('Entry not found. It may have been deleted.');
          return;
        }
        
        if (entry.exercise !== "Other Activity") {
          log(LOG_LEVELS.WARN, 'Edit failed: Not an activity log entry');
          alert('Only activity log entries can be edited here.');
          return;
        }
        
        // Populate the activity form with existing data
        activityInput.value = entry.comments || "";
        activityDateInput.value = entry.date;
        
        if (entry.bodyWeight) {
          includeBodyWeightCheckbox.checked = true;
          bodyWeightInputDiv.classList.remove('hidden');
          bodyWeightInput.value = entry.bodyWeight;
        } else {
          includeBodyWeightCheckbox.checked = false;
          bodyWeightInputDiv.classList.add('hidden');
          bodyWeightInput.value = "";
        }
        
        // Store the entry ID for updating
        activityInput.dataset.editingId = entryId;
        
        // Change button text
        const saveButton = document.getElementById("saveActivity");
        saveButton.textContent = "Update Entry";
        
        // Scroll to activity section
        activityLogSection.scrollIntoView({ behavior: 'smooth' });
        
        log(LOG_LEVELS.INFO, 'Activity form populated for editing');
      }

      function deleteEntry(id) {
        const entryId = parseInt(id, 10);
        log(LOG_LEVELS.INFO, `deleteEntry() called with ID: ${entryId}`);
        
        // Validate entry exists before deleting
        const entryIndex = workoutHistory.findIndex(e => e.id === entryId);
        if (entryIndex === -1) {
          log(LOG_LEVELS.ERROR, `Cannot delete: Entry not found with ID ${entryId}`);
          alert('Entry not found. It may have already been deleted.');
          return;
        }
        
        const entryToDelete = workoutHistory[entryIndex];
        log(LOG_LEVELS.DEBUG, `Deleting entry: ${entryToDelete.exercise} on ${entryToDelete.date}`);
        
        showLoading('Deleting entry...', 500).then(() => {
          const originalLength = workoutHistory.length;
          workoutHistory = workoutHistory.filter(e => e.id !== entryId);
          
          if (workoutHistory.length === originalLength) {
            log(LOG_LEVELS.ERROR, 'Deletion failed: Entry was not removed from array');
            alert('Failed to delete entry. Please try again.');
            return;
          }
          
          try {
            localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));
            log(LOG_LEVELS.INFO, `Entry deleted successfully. ${workoutHistory.length} entries remaining`);
          } catch (storageError) {
            log(LOG_LEVELS.ERROR, 'Failed to update localStorage after deletion', storageError);
            alert('Entry deleted but failed to save. Changes may not persist.');
          }
          renderHistory();
          setupHistoryChart(); // Refresh chart data
          setState(states.ENTRY_DELETED);
        });
      }

      function deleteAll() {
        log(LOG_LEVELS.WARN, 'deleteAll() called - Attempting to delete all entries.');
        showConfirmationModal(() => {
            log(LOG_LEVELS.WARN, 'User confirmed deletion of all entries.');
            showLoading('Deleting all entries...', 700).then(() => {
              workoutHistory = [];
              try {
                localStorage.removeItem("workoutHistory");
                log(LOG_LEVELS.INFO, 'All entries removed from localStorage successfully');
              } catch (storageError) {
                log(LOG_LEVELS.ERROR, 'Failed to remove data from localStorage', storageError);
              }
              renderHistory();
              setupHistoryChart(); // Refresh chart data
              setState(states.ALL_DELETED);
            });
        });
      }

      function toggleHistory() {
        log(LOG_LEVELS.INFO, 'toggleHistory() called');
        
        // Clear any active edit state when navigating
        clearActivityEditState();
        
        const isNowHidden = historySection.classList.toggle("hidden");
        log(LOG_LEVELS.INFO, `History view toggled. Is now hidden: ${isNowHidden}`);
        
        if (isNowHidden) {
          showLoading('Returning to exercises...', 400).then(() => {
            exerciseSection.classList.remove("hidden");
            activityLogSection.classList.remove("hidden");
            workoutForm.classList.add("hidden");
            toggleHistoryBtn.textContent = "History";
            if (chartInstance && typeof chartInstance.destroy === 'function') {
              try {
                chartInstance.destroy();
                log(LOG_LEVELS.INFO, 'Chart instance destroyed on history exit');
              } catch (destroyError) {
                log(LOG_LEVELS.ERROR, 'Failed to destroy chart instance', destroyError);
                // Continue anyway - chart will be recreated if needed
              }
              chartInstance = null;
            }
            chartContainer.classList.add('hidden');
            currentWeekOffset = 0; // Reset to current week
            chartViewMode = 'all-time'; // Reset chart view mode
            chartAllTimeBtn.classList.add('active');
            chartCurrentWeekBtn.classList.remove('active');
            setState(states.IDLE);
          });
        } else {
          showLoading('Loading history...', 500).then(() => {
            exerciseSection.classList.add("hidden");
            activityLogSection.classList.add("hidden");
            workoutForm.classList.add("hidden");
            toggleHistoryBtn.textContent = "Back";
            currentWeekOffset = 0; // Start with current week
            renderHistory();
            setupHistoryChart();
            setState(states.VIEWING_HISTORY);
          });
        }
      }
      
      function navigateWeek(direction) {
        // direction: -1 for previous, +1 for next
        log(LOG_LEVELS.INFO, `navigateWeek() called with direction: ${direction}`);
        
        const newOffset = currentWeekOffset + direction;
        
        // Prevent navigating too far back (performance safeguard)
        const MAX_WEEKS_BACK = 104; // 2 years
        if (newOffset < -MAX_WEEKS_BACK) {
          log(LOG_LEVELS.WARN, `Cannot navigate beyond ${MAX_WEEKS_BACK} weeks back`);
          alert(`Maximum history limit reached (${MAX_WEEKS_BACK} weeks / 2 years)`);
          return;
        }
        
        // Prevent navigating to future
        if (newOffset > 0) {
          log(LOG_LEVELS.WARN, 'Cannot navigate to future weeks');
          return;
        }
        
        currentWeekOffset = newOffset;
        log(LOG_LEVELS.INFO, `New week offset: ${currentWeekOffset}`);
        showLoading('Loading week...', 300).then(() => {
          renderHistory();
          // Update chart if in current-week mode
          if (chartViewMode === 'current-week' && chartExerciseSelect.value) {
            drawChart(chartExerciseSelect.value);
          }
        });
      }

      // --- Charting Functions ---
      function setupHistoryChart() {
        log(LOG_LEVELS.INFO, 'setupHistoryChart() called');
        const exercisesWithHistory = [...new Set(workoutHistory.map(entry => entry.exercise))].filter(ex => ex !== "Other Activity");
        
        if (exercisesWithHistory.length === 0) {
            log(LOG_LEVELS.INFO, 'No exercises with history found - hiding chart container');
            chartContainer.classList.add('hidden');
            return;
        }

        log(LOG_LEVELS.INFO, `Found ${exercisesWithHistory.length} exercises with history:`, exercisesWithHistory);
        chartContainer.classList.remove('hidden');
        chartExerciseSelect.innerHTML = exercisesWithHistory.map(ex => `<option value="${ex}">${ex}</option>`).join('');
        
        const selectedExercise = chartExerciseSelect.value;
        if (selectedExercise) {
            log(LOG_LEVELS.INFO, `Drawing initial chart for: ${selectedExercise}`);
            drawChart(selectedExercise);
        }
      }

      function drawChart(exercise, skipLoading = false) {
        log(LOG_LEVELS.INFO, `drawChart() called for exercise: ${exercise}, skipLoading: ${skipLoading}`);
        
        const generateChart = () => {
          log(LOG_LEVELS.INFO, 'Generating chart data...');
          // Filter data based on view mode
          let filteredData;
          if (chartViewMode === 'current-week') {
            const { start, end } = getWeekBounds(currentWeekOffset);
            filteredData = workoutHistory.filter(e => e.exercise === exercise && isDateInRange(e.date, start, end));
            log(LOG_LEVELS.INFO, `Current-week mode: filtered ${filteredData.length} entries`);
          } else {
            filteredData = workoutHistory.filter(e => e.exercise === exercise);
            log(LOG_LEVELS.INFO, `All-time mode: filtered ${filteredData.length} entries`);
          }
          
          const data = filteredData.sort((a, b) => new Date(a.date) - new Date(b.date));
          
          if (chartInstance && typeof chartInstance.destroy === 'function') {
            try {
              chartInstance.destroy();
              log(LOG_LEVELS.INFO, 'Previous chart instance destroyed');
            } catch (destroyError) {
              log(LOG_LEVELS.ERROR, 'Failed to destroy previous chart instance', destroyError);
              // Continue anyway
            }
            chartInstance = null;
          }
          
          // Allow single data point display (edge case fix)
          if (data.length < 1) {
               log(LOG_LEVELS.INFO, `No data to draw chart for ${exercise}.`);
               document.getElementById('progressChart').classList.add('hidden');
               return;
          }
          
          if (data.length === 1) {
            log(LOG_LEVELS.INFO, `Only 1 data point for ${exercise}, chart will show single point`);
          }
          
          document.getElementById('progressChart').classList.remove('hidden');

          const labels = data.map(d => {
            try {
              const dateObj = parseDateLocal(d.date);
              return dateObj.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
              });
            } catch (dateError) {
              log(LOG_LEVELS.ERROR, `Invalid date in chart data: ${d.date}`, dateError);
              return 'Invalid Date';
            }
          });
          
          // Get current theme for chart colors
          const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
          const textColor = isDarkMode ? '#f5f5f5' : '#111827';
          const gridColor = isDarkMode ? 'rgba(115, 115, 115, 0.3)' : 'rgba(209, 213, 219, 0.3)';
          
          // Build datasets based on checkbox selections
          const datasets = [];
          
          if (showWeightCheckbox.checked) {
            datasets.push({ 
              label: "Weight (lbs)", 
              data: data.map(d => d.weight), 
              borderColor: "#2563eb", 
              backgroundColor: "rgba(37, 99, 235, 0.1)",
              borderWidth: 3,
              pointRadius: 5,
              pointHoverRadius: 7,
              tension: 0.3,
              fill: true,
              yAxisID: 'yWeight'
            });
            log(LOG_LEVELS.INFO, 'Weight dataset added to chart');
          }
          
          if (showVolumeCheckbox.checked) {
            datasets.push({ 
              label: "Total Volume (lbs)", 
              data: data.map(d => d.weight * d.sets * d.reps), 
              borderColor: "#10b981", 
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              borderWidth: 3,
              pointRadius: 5,
              pointHoverRadius: 7,
              tension: 0.3,
              fill: true,
              yAxisID: 'yWeight'
            });
            log(LOG_LEVELS.INFO, 'Volume dataset added to chart');
          }
          
          if (showRPECheckbox.checked) {
            datasets.push({ 
              label: "RPE", 
              data: data.map(d => d.rpe),
              borderColor: "#ef4444", 
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              borderWidth: 2,
              borderDash: [5, 5],
              pointRadius: 4,
              pointHoverRadius: 6,
              tension: 0.3,
              fill: false,
              yAxisID: 'yRPE'
            });
            log(LOG_LEVELS.INFO, 'RPE dataset added to chart');
          }
          
          if (showBodyWeightCheckbox.checked) {
            const bodyWeightData = data.map(d => d.bodyWeight || null);
            // Only add if there's at least one body weight entry
            if (bodyWeightData.some(bw => bw !== null)) {
              datasets.push({ 
                label: "Body Weight (lbs)", 
                data: bodyWeightData,
                borderColor: "#f59e0b", 
                backgroundColor: "rgba(245, 158, 11, 0.1)",
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                tension: 0.3,
                fill: false,
                yAxisID: 'yBodyWeight',
                spanGaps: true
              });
              log(LOG_LEVELS.INFO, 'Body Weight dataset added to chart');
            }
          }
          
          // Validate that at least one dataset exists
          if (datasets.length === 0) {
            log(LOG_LEVELS.WARN, 'No datasets to display - all checkboxes unchecked or no data');
            document.getElementById('progressChart').classList.add('hidden');
            return;
          }
          
          const chartData = { labels, datasets };
          log(LOG_LEVELS.INFO, `Chart will be rendered with ${datasets.length} dataset(s)`);
          
          // Guard against empty chart data
          if (!chartData.labels.length) {
            chartContainer.innerHTML = '<p class="chart-message">No data available to display.</p>';
            log(LOG_LEVELS.WARN, 'Chart data has no labels - cannot render chart');
            return;
          }

          // Build scales dynamically based on what's shown
          const scales = {
            x: { 
              ticks: { color: textColor },
              grid: { color: gridColor }
            }
          };
          
          // Add weight/volume axis if either is selected
          if (showWeightCheckbox.checked || showVolumeCheckbox.checked) {
            scales.yWeight = { 
              type: 'linear', 
              display: true, 
              position: 'left', 
              title: { 
                display: true, 
                text: 'Weight / Volume (lbs)', 
                color: textColor,
                font: { size: 14, weight: 'bold' }
              }, 
              ticks: { color: textColor },
              grid: { color: gridColor }
            };
          }
          
          // Add RPE axis if selected
          if (showRPECheckbox.checked) {
            scales.yRPE = {
              type: 'linear',
              display: true,
              position: 'right',
              min: 1,
              max: 10,
              title: {
                display: true,
                text: 'RPE',
                color: '#ef4444',
                font: { size: 14, weight: 'bold' }
              },
              ticks: { 
                color: '#ef4444',
                stepSize: 1
              },
              grid: { drawOnChartArea: false }
            };
          }
          
          // Add body weight axis if selected
          if (showBodyWeightCheckbox.checked && data.some(d => d.bodyWeight)) {
            scales.yBodyWeight = {
              type: 'linear',
              display: true,
              position: 'right',
              title: {
                display: true,
                text: 'Body Weight (lbs)',
                color: '#f59e0b',
                font: { size: 14, weight: 'bold' }
              },
              ticks: { 
                color: '#f59e0b'
              },
              grid: { drawOnChartArea: false }
            };
          }

          const chartOptions = {
            responsive: true, 
            maintainAspectRatio: true,
            interaction: { 
              mode: 'index', 
              intersect: false 
            },
            scales,
            plugins: { 
              legend: { 
                labels: { 
                  color: textColor,
                  padding: 15,
                  font: { size: 12 },
                  usePointStyle: true
                } 
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    let label = context.dataset.label || '';
                    if (label) {
                      label += ': ';
                    }
                    if (context.dataset.label === 'RPE') {
                      label += context.parsed.y;
                    } else {
                      label += Math.round(context.parsed.y) + ' lbs';
                    }
                    return label;
                  },
                  afterLabel: function(context) {
                    // Add sets x reps info for non-body weight entries
                    if (context.dataset.label !== 'Body Weight (lbs)') {
                      const dataIndex = context.dataIndex;
                      const entry = data[dataIndex];
                      if (entry.sets && entry.reps) {
                        return `${entry.sets} sets × ${entry.reps} reps`;
                      }
                    }
                    return '';
                  }
                }
              }
            }
          };

          chartInstance = new Chart(document.getElementById("progressChart").getContext("2d"), {
            type: "line", data: chartData, options: chartOptions
          });
          log(LOG_LEVELS.INFO, 'Chart instance created successfully');
        };

        if (skipLoading) {
          generateChart();
        } else {
          showLoading('Generating chart...', 600).then(generateChart);
        }
      }

      // --- Modal & Utility Functions ---
      function showConfirmationModal(action) {
        log(LOG_LEVELS.INFO, 'showConfirmationModal() called');
        confirmAction = action;
        confirmModal.classList.remove('hidden');
        // Trigger reflow for animation
        void confirmModal.offsetWidth;
      }

      function hideConfirmationModal() {
        log(LOG_LEVELS.INFO, 'hideConfirmationModal() called');
        confirmAction = null;
        setTimeout(() => {
          confirmModal.classList.add('hidden');
        }, 200);
      }

      function exportCSV() {
        log(LOG_LEVELS.INFO, 'exportCSV() called - Exporting history to CSV.');
        if (workoutHistory.length === 0) {
          log(LOG_LEVELS.WARN, 'Export cancelled - no workout history to export');
          return;
        }
        
        const exportButton = document.getElementById("exportCSV");
        setButtonLoading(exportButton, true);
        
        setTimeout(() => {
          const headers = ["Date", "Exercise", "Weight (lbs)", "Sets", "Reps", "RPE", "Body Weight (lbs)", "Comments"];
          const rows = workoutHistory.map(e => [e.date, e.exercise, e.weight, e.sets, e.reps, e.rpe, e.bodyWeight || "", e.comments || ""]);
          
          // Properly escape quotes in CSV cells
          const csv = [
            headers.join(","),
            ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
          ].join("\n");
          
          log(LOG_LEVELS.INFO, `CSV generated with ${rows.length} rows`);
          
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
          const a = document.createElement("a");
          const url = URL.createObjectURL(blob);
          a.href = url;
          a.download = "workout-history.csv";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          log(LOG_LEVELS.INFO, 'CSV download initiated successfully');
          setButtonLoading(exportButton, false);
        }, 500);
      }

async function copyClipboard() {
        log(LOG_LEVELS.INFO, 'copyClipboard() called - Copying history to clipboard.');
        if (workoutHistory.length === 0) {
          log(LOG_LEVELS.WARN, 'Copy cancelled - no workout history to copy');
          return;
        }
        
        const copyButton = document.getElementById("copyClipboard");
        setButtonLoading(copyButton, true);

        const textToCopy = workoutHistory.map(e => {
            const commentsPart = e.comments ? ` | ${e.comments}` : '';
            const bodyWeightPart = e.bodyWeight ? ` | BW: ${e.bodyWeight} lbs` : '';
            if (e.exercise === "Other Activity") {
              return `${e.date} | ${e.exercise}${bodyWeightPart} | ${e.comments}`;
            }
            return `${e.date} | ${e.exercise} | ${e.weight} lbs | ${e.sets}x${e.reps} @ RPE ${e.rpe}${bodyWeightPart}${commentsPart}`;
        }).join("\n");

        try {
            await navigator.clipboard.writeText(textToCopy);
            log(LOG_LEVELS.INFO, 'History copied to clipboard successfully');
            // Non-blocking feedback is better than an alert
            const originalText = copyButton.textContent;
            copyButton.textContent = 'Copied!';
            setTimeout(() => {
                copyButton.textContent = originalText;
            }, 2000); // Revert text after 2 seconds
        } catch (err) {
            logError("Failed to copy to clipboard", err, false);
            alert("Could not copy to clipboard. Please check browser permissions.");
        } finally {
            setButtonLoading(copyButton, false);
        }
      }

      function logError(message, error, showToUser = true) {
        log(LOG_LEVELS.ERROR, message, error);
        if (showToUser) {
          errorLog.classList.remove("hidden");
          const msg = `${new Date().toISOString()} | ${message}: ${error?.message || error}`;
          const errorDiv = document.createElement('div');
          errorDiv.textContent = msg;
          errorLog.appendChild(errorDiv);
        }
      }

      // --- Event Listeners ---
      function addEventListeners() {
        log(LOG_LEVELS.INFO, 'Adding event listeners.');
        
        // Theme toggle
        themeToggle.addEventListener('click', toggleTheme);
        
        // Weight goal select
        weightGoalSelect.addEventListener('change', (e) => {
          const goal = e.target.value;
          localStorage.setItem('weightGoal', goal);
          log(LOG_LEVELS.INFO, `Weight goal changed to: ${goal}`);
        });
        
        // Settings button
        toggleSettings.addEventListener('click', toggleSettingsSection);
        
        // Message management buttons
        addMotivationalMessage.addEventListener('click', () => addCustomMessage('motivational'));
        addShameMessage.addEventListener('click', () => addCustomMessage('shame'));
        addStrengthMotivationalMessage.addEventListener('click', () => addCustomMessage('strength-motivational'));
        addStrengthShameMessage.addEventListener('click', () => addCustomMessage('strength-shame'));
        resetMessages.addEventListener('click', resetMessagesToDefaults);
        clearMessageTracking.addEventListener('click', clearMessageTrackingHistory);
        
        // Message delete buttons (event delegation)
        motivationalMessagesList.addEventListener('click', (e) => {
          if (e.target.classList.contains('message-delete')) {
            const index = parseInt(e.target.dataset.index, 10);
            deleteCustomMessage('motivational', index);
          }
        });
        
        shameMessagesList.addEventListener('click', (e) => {
          if (e.target.classList.contains('message-delete')) {
            const index = parseInt(e.target.dataset.index, 10);
            deleteCustomMessage('shame', index);
          }
        });
        
        strengthMotivationalMessagesList.addEventListener('click', (e) => {
          if (e.target.classList.contains('message-delete')) {
            const index = parseInt(e.target.dataset.index, 10);
            deleteCustomMessage('strength-motivational', index);
          }
        });
        
        strengthShameMessagesList.addEventListener('click', (e) => {
          if (e.target.classList.contains('message-delete')) {
            const index = parseInt(e.target.dataset.index, 10);
            deleteCustomMessage('strength-shame', index);
          }
        });
        
        // Enter key support for message inputs
        newMotivationalMessage.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addCustomMessage('motivational');
          }
        });
        
        newShameMessage.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addCustomMessage('shame');
          }
        });
        
        newStrengthMotivationalMessage.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addCustomMessage('strength-motivational');
          }
        });
        
        newStrengthShameMessage.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addCustomMessage('strength-shame');
          }
        });
        
        // Body weight checkbox toggles
        includeBodyWeightCheckbox.addEventListener('change', (e) => {
          bodyWeightInputDiv.classList.toggle('hidden', !e.target.checked);
        });

        workoutIncludeBodyWeightCheckbox.addEventListener('change', (e) => {
          workoutBodyWeightInputDiv.classList.toggle('hidden', !e.target.checked);
        });
        
        // Exercise selection dropdowns
        pushSelect.addEventListener('change', (e) => {
          if (e.target.value) {
            clearActivityEditState(); // Clear any pending activity edits
            selectExercise(e.target.value);
            // Reset other dropdowns
            pullSelect.value = "";
            legsSelect.value = "";
          }
        });
        
        pullSelect.addEventListener('change', (e) => {
          if (e.target.value) {
            clearActivityEditState(); // Clear any pending activity edits
            selectExercise(e.target.value);
            // Reset other dropdowns
            pushSelect.value = "";
            legsSelect.value = "";
          }
        });
        
        legsSelect.addEventListener('change', (e) => {
          if (e.target.value) {
            clearActivityEditState(); // Clear any pending activity edits
            selectExercise(e.target.value);
            // Reset other dropdowns
            pushSelect.value = "";
            pullSelect.value = "";
          }
        });

        platesGrid.addEventListener('click', (event) => {
          if (event.target.tagName === 'BUTTON' && event.target.dataset.weight) {
              changePlate(parseFloat(event.target.dataset.weight), parseInt(event.target.dataset.delta, 10));
          }
        });

        historyList.addEventListener('click', (event) => {
            const deleteButton = event.target.closest('.delete-btn');
            const editButton = event.target.closest('.edit-btn');
            
            if (deleteButton && deleteButton.dataset.id) {
                deleteEntry(deleteButton.dataset.id);
            } else if (editButton && editButton.dataset.id) {
                editActivity(editButton.dataset.id);
            }
        });
        
        // Success modal close button
        closeSuccessModal.addEventListener('click', () => {
          log(LOG_LEVELS.DEBUG, '🖱️ Close button clicked on modal');
          hideBodyWeightModal();
        });
        
        chartExerciseSelect.addEventListener('change', (e) => {
            drawChart(e.target.value);
        });
        
        // Add event listeners for chart metric checkboxes
        showWeightCheckbox.addEventListener('change', () => {
            const selectedExercise = chartExerciseSelect.value;
            if (selectedExercise) drawChart(selectedExercise);
        });
        showVolumeCheckbox.addEventListener('change', () => {
            const selectedExercise = chartExerciseSelect.value;
            if (selectedExercise) drawChart(selectedExercise);
        });
        showRPECheckbox.addEventListener('change', () => {
            const selectedExercise = chartExerciseSelect.value;
            if (selectedExercise) drawChart(selectedExercise);
        });
        showBodyWeightCheckbox.addEventListener('change', () => {
            const selectedExercise = chartExerciseSelect.value;
            if (selectedExercise) drawChart(selectedExercise);
        });
        
        // Chart view mode toggle
        chartAllTimeBtn.addEventListener('click', () => {
            chartViewMode = 'all-time';
            chartAllTimeBtn.classList.add('active');
            chartCurrentWeekBtn.classList.remove('active');
            const selectedExercise = chartExerciseSelect.value;
            if (selectedExercise) drawChart(selectedExercise);
        });
        
        chartCurrentWeekBtn.addEventListener('click', () => {
            chartViewMode = 'current-week';
            chartCurrentWeekBtn.classList.add('active');
            chartAllTimeBtn.classList.remove('active');
            const selectedExercise = chartExerciseSelect.value;
            if (selectedExercise) drawChart(selectedExercise);
        });

        dateInput.addEventListener('change', (e) => { log(LOG_LEVELS.INFO, `Date changed to: ${e.target.value}`); });
        modalConfirmBtn.addEventListener('click', () => { if (confirmAction) confirmAction(); hideConfirmationModal(); });
        modalCancelBtn.addEventListener('click', () => { log(LOG_LEVELS.INFO, 'User cancelled action via modal.'); hideConfirmationModal(); });

        document.getElementById("saveWorkout").addEventListener('click', saveWorkout);
        document.getElementById("saveActivity").addEventListener('click', saveActivity);
        document.getElementById("cancelWorkout").addEventListener('click', cancelWorkout);
        toggleHistoryBtn.addEventListener('click', toggleHistory);
        document.getElementById("exportCSV").addEventListener('click', exportCSV);
        document.getElementById("copyClipboard").addEventListener('click', copyClipboard);
        document.getElementById("deleteAll").addEventListener('click', deleteAll);
        
        prevWeekBtn.addEventListener('click', () => navigateWeek(-1));
        nextWeekBtn.addEventListener('click', () => navigateWeek(1));

        // Sets: Sync slider and input with validation
        setsRange.addEventListener('input', (e) => {
            const value = validateSetsReps(e.target.value);
            setsLabel.textContent = `Sets: ${value}`;
            setsInput.value = value;
        });
        setsRange.addEventListener('change', (e) => {
            const value = validateSetsReps(e.target.value);
            log(LOG_LEVELS.INFO, `Sets: ${value}`);
        });
        setsInput.addEventListener('input', (e) => {
            const value = validateSetsReps(e.target.value);
            setsRange.value = value;
            setsInput.value = value; // Update to validated value
            setsLabel.textContent = `Sets: ${value}`;
        });
        setsInput.addEventListener('change', (e) => {
            const value = validateSetsReps(e.target.value);
            log(LOG_LEVELS.INFO, `Sets: ${value}`);
        });
        
        // Reps: Sync slider and input with validation
        repsRange.addEventListener('input', (e) => {
            const value = validateSetsReps(e.target.value);
            repsLabel.textContent = `Reps: ${value}`;
            repsInput.value = value;
        });
        repsRange.addEventListener('change', (e) => {
            const value = validateSetsReps(e.target.value);
            log(LOG_LEVELS.INFO, `Reps: ${value}`);
        });
        repsInput.addEventListener('input', (e) => {
            const value = validateSetsReps(e.target.value);
            repsRange.value = value;
            repsInput.value = value; // Update to validated value
            repsLabel.textContent = `Reps: ${value}`;
        });
        repsInput.addEventListener('change', (e) => {
            const value = validateSetsReps(e.target.value);
            log(LOG_LEVELS.INFO, `Reps: ${value}`);
        });
        
        // RPE: Sync slider and input with logarithmic calculation and validation
        rpeRange.addEventListener('input', (e) => {
            const sliderPosition = e.target.value;
            const rpeValue = validateRPE(calculateLogarithmicRPE(sliderPosition));
            rpeLabel.textContent = `RPE: ${rpeValue}`;
            rpeInput.value = rpeValue;
        });
        rpeRange.addEventListener('change', (e) => {
            const sliderPosition = e.target.value;
            const rpeValue = validateRPE(calculateLogarithmicRPE(sliderPosition));
            log(LOG_LEVELS.INFO, `RPE: ${rpeValue}`);
        });
        rpeInput.addEventListener('input', (e) => {
            const rpeValue = validateRPE(parseFloat(e.target.value) || 0);
            rpeInput.value = rpeValue; // Update to validated value
            // Reverse calculation: position = 10 * sqrt(RPE/10) 
            // Since forward is: RPE = 10 * (position/10)^2
            const sliderPosition = 10 * Math.sqrt(rpeValue / 10);
            rpeRange.value = sliderPosition;
            rpeLabel.textContent = `RPE: ${rpeValue}`;
        });
        rpeInput.addEventListener('change', (e) => {
            const rpeValue = validateRPE(parseFloat(e.target.value) || 0);
            log(LOG_LEVELS.INFO, `RPE: ${rpeValue}`);
        });
        
        // Bar weight: Update total when changed, validate on blur
        barWeightInput.addEventListener('input', (e) => {
            // Allow typing without immediate validation
            updateTotalWeight();
            log(LOG_LEVELS.INFO, `Bar weight input: ${e.target.value}`);
        });
        
        barWeightInput.addEventListener('blur', (e) => {
            // Validate and correct on blur (when user finishes editing)
            const inputValue = e.target.value.trim();
            if (inputValue === '') {
                // If field is empty, restore default
                barWeightInput.value = BAR_WEIGHT;
                log(LOG_LEVELS.INFO, `Bar weight field empty, restored to default: ${BAR_WEIGHT} lbs`);
            } else {
                const value = validateBarWeightInput(inputValue);
                barWeightInput.value = value;
                log(LOG_LEVELS.INFO, `Bar weight validated to: ${value} lbs`);
            }
            updateTotalWeight();
        });
        
        barWeightInput.addEventListener('keydown', (e) => {
            // Handle delete/backspace to empty field
            if ((e.key === 'Delete' || e.key === 'Backspace') && e.target.value.length <= 1) {
                // Will result in empty field, which calculateTotalWeight handles
                setTimeout(() => updateTotalWeight(), 0);
            }
        });
        
        // Prevent form submissions from causing page refresh
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
          form.addEventListener('submit', (e) => {
            e.preventDefault();
            log(LOG_LEVELS.WARN, 'Form submission prevented - buttons should use type="button"');
          });
        });
      }

      // --- Prevent data loss on refresh/close ---
      let operationInProgress = false;
      
      window.addEventListener('beforeunload', (e) => {
        if (operationInProgress) {
          e.preventDefault();
          e.returnValue = 'A save operation is in progress. Are you sure you want to leave?';
          log(LOG_LEVELS.WARN, 'User attempted to close page during operation');
          return e.returnValue;
        }
      });
      
      // --- Start the App ---
      document.addEventListener('DOMContentLoaded', initializeApp);
    })();
