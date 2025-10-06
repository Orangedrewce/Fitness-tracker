// IIFE to encapsulate code and avoid polluting the global scope
    (function() {
      // --- Constants and State ---
      const BAR_WEIGHT = 45;
      const exercises = {
        Push: ["Barbell Bench Press", "Overhead Press (OHP)", "Incline Bench Press", "Decline Bench Press"],
        Pull: ["Bent-Over Row", "Pendlay Row", "Barbell Curl", "Barbell Shrug", "Power Clean", "Power Snatch"],
        Legs: ["Back Squat", "Front Squat", "Overhead Squat", "Romanian Deadlift", "Conventional Deadlift", "Barbell Lunge", "Barbell Hip Thrust", "Standing Calf Raise"],
      };
      const plates = { 45: 0, 35: 0, 25: 0, 10: 0, 5: 0, 2.5: 0 };
      const plateOrder = [45, 35, 25, 10, 5, 2.5];

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
      let currentWeekOffset = 0; // 0 = current week, 1 = previous week, etc.
      let chartViewMode = 'all-time'; // 'all-time' or 'current-week'
      
      // --- Logging Utility ---
      const LOG_LEVELS = { INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' };
      function log(level, message, data = '') {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [${level}] ${message}`, data);
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

      // Range Sliders
      const setsRange = document.getElementById("setsRange");
      const repsRange = document.getElementById("repsRange");
      const rpeRange = document.getElementById("rpeRange");
      const setsLabel = document.getElementById("setsLabel");
      const repsLabel = document.getElementById("repsLabel");
      const rpeLabel = document.getElementById("rpeLabel");
      const commentsInput = document.getElementById("commentsInput");

      // --- Theme Management ---
      function initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
        log(LOG_LEVELS.INFO, `Theme initialized: ${savedTheme}`);
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
          // The second argument 'true' now correctly signals to skip the loading overlay
          drawChart(chartExerciseSelect.value, true); 
        }
      }

      function updateThemeIcon(theme) {
        themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
        themeToggle.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
      }

      // --- Initialization ---
      function initializeApp() {
        log(LOG_LEVELS.INFO, 'Initializing application.');
        initializeTheme();
        
        try {
            workoutHistory = JSON.parse(localStorage.getItem("workoutHistory") || "[]");
            log(LOG_LEVELS.INFO, 'Workout history loaded from localStorage.', workoutHistory);
        } catch (e) {
            logError("Failed to load history from localStorage", e);
            workoutHistory = [];
        }
        
        const today = new Date().toISOString().split("T")[0];
        dateInput.value = today;
        dateInput.max = today; // Prevent selecting future dates
        activityDateInput.value = today;
        activityDateInput.max = today; // Prevent selecting future dates for activities too

        renderExercises();
        renderHistory();
        addEventListeners();
        setState("Idle");
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
        loadingOverlay.classList.remove('show');
        setTimeout(() => {
          loadingOverlay.classList.add('hidden');
        }, 200); // Match transition duration
      }
      
      function setButtonLoading(button, isLoading) {
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
              <button data-weight="${weight}" data-delta="-1">-</button>
              <span id="plate-${weight}">${plates[weight]}</span>
              <button data-weight="${weight}" data-delta="1">+</button>
            </div>`;
          platesGrid.appendChild(div);
        });
      }
      
      // --- Week Calculation Functions ---
      function parseDateLocal(dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
      }
      
function getWeekBounds(offset = 0) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Calculate the start of the current week (Sunday)
        const currentWeekStart = new Date(today);
        currentWeekStart.setDate(today.getDate() - today.getDay());
        
        // Apply offset (plus instead of minus for more intuitive logic)
        const weekStart = new Date(currentWeekStart);
        weekStart.setDate(currentWeekStart.getDate() + (offset * 7));
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        return { start: weekStart, end: weekEnd };
      }
      
      function formatDateRange(start, end) {
        const options = { month: 'short', day: 'numeric', year: 'numeric' };
        return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
      }
      
      function isDateInRange(dateStr, start, end) {
        const date = parseDateLocal(dateStr);
        return date >= start && date <= end;
      }
      
      function getWeekWorkouts(offset = 0) {
        const { start, end } = getWeekBounds(offset);
        return workoutHistory.filter(entry => isDateInRange(entry.date, start, end));
      }
      
      function calculateWeekStats(workouts) {
        if (workouts.length === 0) {
          return {
            totalWorkouts: 0,
            totalVolume: 0,
            avgRPE: 0,
            uniqueExercises: 0
          };
        }
        
        const totalVolume = workouts.reduce((sum, w) => sum + (w.weight * w.sets * w.reps), 0);
        const avgRPE = workouts.reduce((sum, w) => sum + w.rpe, 0) / workouts.length;
        const uniqueExercises = new Set(workouts.map(w => w.exercise)).size;
        
        return {
          totalWorkouts: workouts.length,
          totalVolume: Math.round(totalVolume),
          avgRPE: Number(avgRPE.toFixed(1)),
          uniqueExercises
        };
      }

      function renderHistory() {
        log(LOG_LEVELS.INFO, 'Rendering history.');
        
        // Update week range display
        const { start, end } = getWeekBounds(currentWeekOffset);
        weekRangeEl.textContent = formatDateRange(start, end);
        
        // Enable/disable navigation buttons
        nextWeekBtn.disabled = currentWeekOffset === 0;
        
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
              
              div.innerHTML = `
                <div>
                  <strong>Activity Log</strong><br>
                  <small>${formattedDate}</small>${bodyWeightDisplay}<br>
                  <small style="color: var(--text-secondary); font-style: italic;">${entry.comments}</small>
                </div>
                <button class="delete-btn" data-id="${entry.id}">🗑️</button>
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
          plates[key] = Math.max(0, plates[key] + delta);
          log(LOG_LEVELS.INFO, `Plate changed: weight=${weight}, delta=${delta}, newCount=${plates[key]}`);
          document.getElementById(`plate-${key}`).textContent = plates[key];
          updateTotalWeight();
      }

      function calculateTotalWeight() {
        const plateWeight = Object.entries(plates).reduce((sum, [w, c]) => sum + parseFloat(w) * c * 2, 0);
        return BAR_WEIGHT + plateWeight;
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

      function saveWorkout() {
        const saveButton = document.getElementById("saveWorkout");
        setButtonLoading(saveButton, true);
        
        setTimeout(() => {
          try {
            const sets = parseInt(setsRange.value, 10);
            const reps = parseInt(repsRange.value, 10);
            const rpe = parseInt(rpeRange.value, 10);
            const date = dateInput.value;
            const weight = calculateTotalWeight();
            const comments = commentsInput.value.trim();
            const bodyWeight = workoutIncludeBodyWeightCheckbox.checked ? parseFloat(workoutBodyWeightInput.value) : null;

            if (!currentExercise) {
              log(LOG_LEVELS.WARN, 'Save attempt failed: No exercise selected.');
              alert("Please select an exercise.");
              setButtonLoading(saveButton, false);
              return;
            }
            
            // Validate date is not in the future
            if (new Date(date) > new Date()) {
              log(LOG_LEVELS.WARN, 'Save attempt failed: Future date selected.');
              alert("Cannot save workouts for future dates.");
              setButtonLoading(saveButton, false);
              return;
            }
            
            // Validate body weight if checkbox is checked
            if (workoutIncludeBodyWeightCheckbox.checked && (!workoutBodyWeightInput.value || isNaN(bodyWeight))) {
              log(LOG_LEVELS.WARN, 'Save attempt failed: Invalid body weight.');
              alert("Please enter a valid body weight.");
              setButtonLoading(saveButton, false);
              return;
            }

            const entry = { id: Date.now(), exercise: currentExercise, weight, sets, reps, rpe, date, comments, bodyWeight };
            log(LOG_LEVELS.INFO, 'Saving workout.', entry);
            workoutHistory.push(entry);
            localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));

            showLoading('Saving workout...', 600).then(() => {
              renderHistory();
              cancelWorkout();
              setState(states.SAVED);
              setButtonLoading(saveButton, false);
            });
          } catch (e) {
            logError("Failed to save workout", e);
            setButtonLoading(saveButton, false);
          }
        }, 100);
      }

      function saveActivity() {
        const saveButton = document.getElementById("saveActivity");
        setButtonLoading(saveButton, true);
        
        setTimeout(() => {
          try {
            const activity = activityInput.value.trim();
            const date = activityDateInput.value;
            const bodyWeight = includeBodyWeightCheckbox.checked ? parseFloat(bodyWeightInput.value) : null;
            
            // OR gate: Allow activity OR body weight OR both
            if (!activity && !includeBodyWeightCheckbox.checked) {
              log(LOG_LEVELS.WARN, 'Save activity failed: No activity or body weight entered.');
              alert("Please enter an activity note or log your body weight.");
              setButtonLoading(saveButton, false);
              return;
            }
            
            if (new Date(date) > new Date()) {
              log(LOG_LEVELS.WARN, 'Save activity failed: Future date selected.');
              alert("Cannot log activities for future dates.");
              setButtonLoading(saveButton, false);
              return;
            }
            
            // Validate body weight if checkbox is checked
            if (includeBodyWeightCheckbox.checked && (!bodyWeightInput.value || isNaN(bodyWeight))) {
              log(LOG_LEVELS.WARN, 'Save activity failed: Invalid body weight.');
              alert("Please enter a valid body weight.");
              setButtonLoading(saveButton, false);
              return;
            }
            
            const entry = { 
              id: Date.now(), 
              exercise: "Other Activity", 
              weight: 0, 
              sets: 0, 
              reps: 0, 
              rpe: 0, 
              date, 
              comments: activity || "Body weight check-in",
              bodyWeight 
            };
            
            log(LOG_LEVELS.INFO, 'Saving activity log.', entry);
            workoutHistory.push(entry);
            localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));
            
            showLoading('Logging activity...', 600).then(() => {
              renderHistory();
              activityInput.value = "";
              bodyWeightInput.value = "";
              includeBodyWeightCheckbox.checked = false;
              bodyWeightInputDiv.classList.add('hidden');
              const today = new Date().toISOString().split("T")[0];
              activityDateInput.value = today;
              setState(states.SAVED);
              setButtonLoading(saveButton, false);
            });
          } catch (e) {
            logError("Failed to save activity", e);
            setButtonLoading(saveButton, false);
          }
        }, 100);
      }

      function cancelWorkout() {
        log(LOG_LEVELS.INFO, 'Workout cancelled.');
        for (let key in plates) plates[key] = 0;
        commentsInput.value = "";
        workoutBodyWeightInput.value = "";
        workoutIncludeBodyWeightCheckbox.checked = false;
        workoutBodyWeightInputDiv.classList.add('hidden');
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
      }

      function deleteEntry(id) {
        const entryId = parseInt(id, 10);
        log(LOG_LEVELS.INFO, `Deleting entry with ID: ${entryId}`);
        
        showLoading('Deleting entry...', 500).then(() => {
          workoutHistory = workoutHistory.filter(e => e.id !== entryId);
          localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));
          renderHistory();
          setupHistoryChart(); // Refresh chart data
          setState(states.ENTRY_DELETED);
        });
      }

      function deleteAll() {
        log(LOG_LEVELS.WARN, 'Attempting to delete all entries.');
        showConfirmationModal(() => {
            log(LOG_LEVELS.WARN, 'User confirmed deletion of all entries.');
            showLoading('Deleting all entries...', 700).then(() => {
              workoutHistory = [];
              localStorage.removeItem("workoutHistory");
              renderHistory();
              setupHistoryChart(); // Refresh chart data
              setState(states.ALL_DELETED);
            });
        });
      }

      function toggleHistory() {
        const isNowHidden = historySection.classList.toggle("hidden");
        log(LOG_LEVELS.INFO, `Toggling history view. Is now hidden: ${isNowHidden}`);
        
        if (isNowHidden) {
          showLoading('Returning to exercises...', 400).then(() => {
            exerciseSection.classList.remove("hidden");
            activityLogSection.classList.remove("hidden");
            workoutForm.classList.add("hidden");
            toggleHistoryBtn.textContent = "History";
            if (chartInstance) chartInstance.destroy();
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
        currentWeekOffset += direction;
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
        const exercisesWithHistory = [...new Set(workoutHistory.map(entry => entry.exercise))].filter(ex => ex !== "Other Activity");
        
        if (exercisesWithHistory.length === 0) {
            chartContainer.classList.add('hidden');
            return;
        }

        chartContainer.classList.remove('hidden');
        chartExerciseSelect.innerHTML = exercisesWithHistory.map(ex => `<option value="${ex}">${ex}</option>`).join('');
        
        const selectedExercise = chartExerciseSelect.value;
        if (selectedExercise) {
            drawChart(selectedExercise);
        }
      }

      function drawChart(exercise, skipLoading = false) {
        log(LOG_LEVELS.INFO, `Drawing chart for exercise: ${exercise}`);
        
        const generateChart = () => {
          // Filter data based on view mode
          let filteredData;
          if (chartViewMode === 'current-week') {
            const { start, end } = getWeekBounds(currentWeekOffset);
            filteredData = workoutHistory.filter(e => e.exercise === exercise && isDateInRange(e.date, start, end));
          } else {
            filteredData = workoutHistory.filter(e => e.exercise === exercise);
          }
          
          const data = filteredData.sort((a, b) => new Date(a.date) - new Date(b.date));
          
          if (chartInstance) chartInstance.destroy();
          
          if (data.length < 2) {
               log(LOG_LEVELS.INFO, `Not enough data to draw chart for ${exercise}. Need at least 2 entries.`);
               document.getElementById('progressChart').classList.add('hidden');
               return;
          }
          document.getElementById('progressChart').classList.remove('hidden');

          const labels = data.map(d => {
            const dateObj = parseDateLocal(d.date);
            return dateObj.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            });
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
            }
          }
          
          const chartData = { labels, datasets };

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
        };

        if (skipLoading) {
          generateChart();
        } else {
          showLoading('Generating chart...', 600).then(generateChart);
        }
      }

      // --- Modal & Utility Functions ---
      function showConfirmationModal(action) {
        confirmAction = action;
        confirmModal.classList.remove('hidden');
        // Trigger reflow for animation
        void confirmModal.offsetWidth;
      }

      function hideConfirmationModal() {
        confirmAction = null;
        setTimeout(() => {
          confirmModal.classList.add('hidden');
        }, 200);
      }

      function exportCSV() {
        log(LOG_LEVELS.INFO, 'Exporting history to CSV.');
        if (workoutHistory.length === 0) return;
        
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
          
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
          const a = document.createElement("a");
          const url = URL.createObjectURL(blob);
          a.href = url;
          a.download = "workout-history.csv";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          setButtonLoading(exportButton, false);
        }, 500);
      }

async function copyClipboard() {
        log(LOG_LEVELS.INFO, 'Copying history to clipboard.');
        if (workoutHistory.length === 0) return;
        
        const copyButton = document.getElementById("copyClipboard");
        setButtonLoading(copyButton, true);

        // The 400ms timeout is no longer needed with the async operation
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
            selectExercise(e.target.value);
            // Reset other dropdowns
            pullSelect.value = "";
            legsSelect.value = "";
          }
        });
        
        pullSelect.addEventListener('change', (e) => {
          if (e.target.value) {
            selectExercise(e.target.value);
            // Reset other dropdowns
            pushSelect.value = "";
            legsSelect.value = "";
          }
        });
        
        legsSelect.addEventListener('change', (e) => {
          if (e.target.value) {
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
            if (deleteButton && deleteButton.dataset.id) {
                deleteEntry(deleteButton.dataset.id);
            }
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

        setsRange.addEventListener('input', (e) => { 
            setsLabel.textContent = `Sets: ${e.target.value}`;
            log(LOG_LEVELS.INFO, `Sets slider changed to: ${e.target.value}`); 
        });
        repsRange.addEventListener('input', (e) => { 
            repsLabel.textContent = `Reps: ${e.target.value}`;
            log(LOG_LEVELS.INFO, `Reps slider changed to: ${e.target.value}`); 
        });
        rpeRange.addEventListener('input', (e) => { 
            rpeLabel.textContent = `RPE: ${e.target.value}`;
            log(LOG_LEVELS.INFO, `RPE slider changed to: ${e.target.value}`); 
        });
      }

      // --- Start the App ---
      document.addEventListener('DOMContentLoaded', initializeApp);
    })();
