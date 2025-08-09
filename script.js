class ConferenceSchedulePlanner {
    constructor() {
        this.schedules = new Map(); // Store multiple schedules
        this.currentScheduleId = null;
        this.selectedTalks = new Set();
        this.timelineActive = false;
        this.timelineInterval = null;
        this.currentDate = new Date();
        this.activeDay = null;
        
        this.initializeEventListeners();
        this.loadSchedules();
        this.updateScheduleSelector();
        this.checkForSharedSchedule();
    }

    initializeEventListeners() {
        // Schedule management
        document.getElementById('scheduleSelector').addEventListener('change', (e) => this.switchSchedule(e.target.value));
        document.getElementById('newScheduleBtn').addEventListener('click', () => this.showImportSection());
        document.getElementById('deleteScheduleBtn').addEventListener('click', () => this.deleteCurrentSchedule());
        
        // Import methods
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadFromURL());
        document.getElementById('importBtn').addEventListener('click', () => this.importFromFile());
        
        // Schedule controls
        document.getElementById('clearBtn').addEventListener('click', () => this.clearSelections());
        document.getElementById('timelineToggle').addEventListener('click', () => this.toggleTimeline());
        
        // Add sharing controls with error handling
        this.attachSharingListeners();
        
        // File input
        document.getElementById('htmlFile').addEventListener('change', (e) => {
            document.getElementById('importBtn').disabled = e.target.files.length === 0;
        });
        
        // URL input
        document.getElementById('scheduleURL').addEventListener('input', (e) => {
            document.getElementById('downloadBtn').disabled = !e.target.value.trim();
        });
        
        // Tab functionality
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
    }

    attachSharingListeners() {
        // Try to attach sharing event listeners with error handling
        try {
            const shareBtn = document.getElementById('shareBtn');
            const exportBtn = document.getElementById('exportBtn');
            const importBtn = document.getElementById('importScheduleBtn');
            
            if (shareBtn) {
                shareBtn.addEventListener('click', () => this.shareSchedule());
                console.log('Share button listener attached');
            } else {
                console.warn('Share button not found');
            }
            
            if (exportBtn) {
                exportBtn.addEventListener('click', () => this.exportSchedule());
                console.log('Export button listener attached');
            } else {
                console.warn('Export button not found');
            }
            
            if (importBtn) {
                importBtn.addEventListener('click', () => this.importScheduleFromFile());
                console.log('Import schedule button listener attached');
            } else {
                console.warn('Import schedule button not found');
            }
        } catch (error) {
            console.error('Error attaching sharing listeners:', error);
        }
    }

    loadSchedules() {
        const stored = localStorage.getItem('conferenceSchedules');
        if (stored) {
            const data = JSON.parse(stored);
            this.schedules = new Map(Object.entries(data.schedules || {}));
            this.currentScheduleId = data.currentScheduleId;
        }
    }

    saveSchedules() {
        const data = {
            schedules: Object.fromEntries(this.schedules),
            currentScheduleId: this.currentScheduleId
        };
        localStorage.setItem('conferenceSchedules', JSON.stringify(data));
    }

    loadSelections(scheduleId) {
        const schedule = this.schedules.get(scheduleId);
        if (schedule && schedule.selections) {
            this.selectedTalks = new Set(schedule.selections);
        } else {
            this.selectedTalks = new Set();
        }
    }

    saveSelections() {
        if (!this.currentScheduleId) return;
        
        const schedule = this.schedules.get(this.currentScheduleId);
        if (schedule) {
            schedule.selections = Array.from(this.selectedTalks);
            this.saveSchedules();
        }
    }

    updateScheduleSelector() {
        const selector = document.getElementById('scheduleSelector');
        const deleteBtn = document.getElementById('deleteScheduleBtn');
        
        // Clear existing options
        selector.innerHTML = '<option value="">Select a schedule...</option>';
        
        // Add schedules
        this.schedules.forEach((schedule, id) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = schedule.name;
            if (id === this.currentScheduleId) {
                option.selected = true;
            }
            selector.appendChild(option);
        });
        
        deleteBtn.disabled = !this.currentScheduleId;
        
        // Show/hide sections
        if (this.currentScheduleId && this.schedules.has(this.currentScheduleId)) {
            document.getElementById('importSection').style.display = 'none';
            document.getElementById('scheduleView').style.display = 'block';
            this.loadCurrentSchedule();
            // Ensure sharing listeners are attached when schedule view is shown
            setTimeout(() => this.attachSharingListeners(), 100);
        } else {
            document.getElementById('importSection').style.display = 'none';
            document.getElementById('scheduleView').style.display = 'none';
        }
    }

    showImportSection() {
        this.currentScheduleId = null;
        document.getElementById('importSection').style.display = 'block';
        document.getElementById('scheduleView').style.display = 'none';
        document.getElementById('scheduleSelector').value = '';
        document.getElementById('deleteScheduleBtn').disabled = true;
        
        // Clear form
        document.getElementById('scheduleName').value = '';
        document.getElementById('scheduleURL').value = '';
        document.getElementById('htmlFile').value = '';
        document.getElementById('downloadBtn').disabled = true;
        document.getElementById('importBtn').disabled = true;
    }

    switchSchedule(scheduleId) {
        if (!scheduleId) {
            this.showImportSection();
            return;
        }
        
        this.currentScheduleId = scheduleId;
        this.saveSchedules();
        this.updateScheduleSelector();
    }

    deleteCurrentSchedule() {
        if (!this.currentScheduleId) return;
        
        const schedule = this.schedules.get(this.currentScheduleId);
        if (schedule && confirm(`Delete "${schedule.name}"?`)) {
            this.schedules.delete(this.currentScheduleId);
            this.currentScheduleId = null;
            this.saveSchedules();
            this.updateScheduleSelector();
        }
    }

    loadCurrentSchedule() {
        const schedule = this.schedules.get(this.currentScheduleId);
        if (!schedule) return;
        
        this.loadSelections(this.currentScheduleId);
        document.getElementById('currentScheduleTitle').textContent = schedule.name;
        
        // Restore Date objects from localStorage strings
        this.restoreDateObjects(schedule.data);
        
        this.enrichWithDateTimes(schedule.data);
        this.renderTimeline(schedule.data);
        this.updateMySchedule();
        this.updateTalkStates();
    }

    restoreDateObjects(scheduleData) {
        console.log('Restoring Date objects from localStorage...');
        
        scheduleData.forEach(day => {
            // Restore day.date if it's a string
            if (day.date && typeof day.date === 'string') {
                day.date = new Date(day.date);
                console.log(`Restored day.date for ${day.day}:`, day.date);
            }
            
            // Restore datetime objects for all talks
            day.timeSlots.forEach(slot => {
                if (slot.isPeriodSeparator) return;
                
                slot.events.forEach(event => {
                    event.talks.forEach(talk => {
                        // Restore startDateTime and endDateTime
                        if (talk.startDateTime && typeof talk.startDateTime === 'string') {
                            talk.startDateTime = new Date(talk.startDateTime);
                        }
                        if (talk.endDateTime && typeof talk.endDateTime === 'string') {
                            talk.endDateTime = new Date(talk.endDateTime);
                        }
                        if (talk.dayDate && typeof talk.dayDate === 'string') {
                            talk.dayDate = new Date(talk.dayDate);
                        }
                        
                        if (talk.startDateTime) {
                            console.log(`Restored datetime for talk: ${talk.title} | ${talk.startDateTime.toLocaleString()}`);
                        }
                    });
                });
            });
        });
        
        console.log('Date object restoration complete');
    }

    enrichWithDateTimes(scheduleData) {
        console.log('Enriching talks with datetime info...');
        
        // Add full datetime information to all talks
        scheduleData.forEach(day => {
            console.log(`Processing day: ${day.day}, date: ${day.date ? day.date.toDateString() : 'No date'}`);
            
            if (!day.date) {
                console.log(`Skipping day ${day.day} - no date parsed`);
                return;
            }
            
            day.timeSlots.forEach(slot => {
                if (slot.isPeriodSeparator) return;
                
                slot.events.forEach(event => {
                    event.talks.forEach(talk => {
                        const timeRange = this.parseTimeRange(talk.time);
                        if (timeRange && day.date) {
                            // Create full datetime for start and end
                            const startDateTime = new Date(day.date);
                            startDateTime.setHours(Math.floor(timeRange.start / 60), timeRange.start % 60, 0, 0);
                            
                            const endDateTime = new Date(day.date);
                            endDateTime.setHours(Math.floor(timeRange.end / 60), timeRange.end % 60, 0, 0);
                            
                            talk.startDateTime = startDateTime;
                            talk.endDateTime = endDateTime;
                            talk.dayDate = day.date;
                            // Ensure dayId is set correctly
                            talk.dayId = day.dayId;
                            
                            console.log(`Enriched talk: ${talk.title} | Day: ${talk.dayId} | ${talk.time} -> ${startDateTime.toLocaleString()} to ${endDateTime.toLocaleString()}`);
                        } else {
                            // Still set dayId even if datetime enrichment fails
                            talk.dayDate = day.date;
                            talk.dayId = day.dayId;
                            console.log(`Could not enrich talk: ${talk.title} | Day: ${talk.dayId} | Time: ${talk.time} | TimeRange: ${timeRange ? 'OK' : 'FAILED'} | Day Date: ${day.date ? 'OK' : 'FAILED'}`);
                        }
                    });
                });
            });
        });
        
        console.log('DateTime enrichment complete');
    }

    async downloadFromURL() {
        const url = document.getElementById('scheduleURL').value.trim();
        const name = document.getElementById('scheduleName').value.trim();
        
        if (!url || !name) {
            this.showStatus('Please enter both schedule name and URL', 'error');
            return;
        }

        try {
            this.showStatus('Downloading schedule...', 'info');
            document.getElementById('downloadBtn').disabled = true;
            
            // Try multiple CORS proxy services
            const proxies = [
                `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
                `https://cors-anywhere.herokuapp.com/${url}`,
                `https://thingproxy.freeboard.io/fetch/${url}`
            ];
            
            let htmlContent = null;
            let lastError = null;
            
            for (const proxyUrl of proxies) {
                try {
                    const response = await fetch(proxyUrl);
                    if (response.ok) {
                        htmlContent = await response.text();
                        break;
                    }
                } catch (error) {
                    lastError = error;
                    console.log(`Proxy failed: ${proxyUrl}`, error);
                }
            }
            
            if (!htmlContent) {
                throw new Error(`All proxies failed. Last error: ${lastError?.message || 'Unknown'}. Please try uploading the HTML file instead.`);
            }
            
            await this.processScheduleData(name, htmlContent, url);
            
        } catch (error) {
            console.error('Download error:', error);
            this.showStatus(error.message, 'error');
        } finally {
            document.getElementById('downloadBtn').disabled = false;
        }
    }

    async importFromFile() {
        const file = document.getElementById('htmlFile').files[0];
        const name = document.getElementById('scheduleName').value.trim();
        
        if (!file || !name) {
            this.showStatus('Please enter schedule name and select a file', 'error');
            return;
        }

        try {
            const htmlContent = await this.readFileAsText(file);
            await this.processScheduleData(name, htmlContent, file.name);
        } catch (error) {
            console.error('Import error:', error);
            this.showStatus(`Failed to import: ${error.message}`, 'error');
        }
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    async processScheduleData(name, htmlContent, source) {
        try {
            const scheduleData = this.parseScheduleHTML(htmlContent);
            
            if (!scheduleData || scheduleData.length === 0) {
                this.showStatus('No schedule data found in the HTML', 'error');
                return;
            }

            // Create new schedule
            const scheduleId = `schedule_${Date.now()}`;
            const schedule = {
                id: scheduleId,
                name: name,
                source: source,
                data: scheduleData,
                selections: [],
                createdAt: new Date().toISOString()
            };

            this.schedules.set(scheduleId, schedule);
            this.currentScheduleId = scheduleId;
            this.selectedTalks = new Set();
            
            this.saveSchedules();
            this.updateScheduleSelector();
            
            this.showStatus(`Successfully imported "${name}" with ${scheduleData.length} days`, 'success');
            
        } catch (error) {
            console.error('Processing error:', error);
            this.showStatus('Error processing schedule data', 'error');
        }
    }

    parseScheduleHTML(htmlContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const scheduleData = [];
        const dayGroups = {};

        const scheduleWrappers = doc.querySelectorAll('.schedule-wrapper');

        scheduleWrappers.forEach(wrapper => {
            const dayHeader = wrapper.querySelector('.head');
            if (!dayHeader) return;

            const fullDay = dayHeader.textContent.trim();
            const dayId = dayHeader.id || `day-${scheduleData.length}`;

            // Extract base day (e.g., "Sunday 10th August" from "Sunday 10th August – Morning")
            const baseDay = fullDay.split(' –')[0].trim();
            const period = fullDay.includes('–') ? fullDay.split('–')[1].trim() : 'Full Day';
            
            // Parse conference date from day string
            const conferenceDate = this.parseConferenceDate(baseDay);

            if (!dayGroups[baseDay]) {
                dayGroups[baseDay] = {
                    day: baseDay,
                    dayId: baseDay.toLowerCase().replace(/\s+/g, '-'),
                    periods: [],
                    date: conferenceDate
                };
            }

            const dayInfo = {
                period: period,
                periodId: dayId,
                roomInfo: '',
                timeSlots: []
            };

            const roomInfoElement = wrapper.querySelector('.roominfo');
            if (roomInfoElement) {
                dayInfo.roomInfo = roomInfoElement.textContent.trim();
            }

            // Parse time slots and events
            const children = Array.from(wrapper.children);
            let currentTimeSlot = null;
            let currentEvents = [];

            children.forEach(child => {
                if (child.classList.contains('time')) {
                    // Save previous time slot
                    if (currentTimeSlot) {
                        dayInfo.timeSlots.push({
                            time: currentTimeSlot,
                            events: [...currentEvents]
                        });
                    }
                    currentTimeSlot = child.textContent.trim();
                    currentEvents = [];
                } else if (child.classList.contains('event')) {
                    const event = this.parseEventElement(child);
                    if (event) {
                        event.dayId = dayGroups[baseDay].dayId;
                        event.periodId = dayId;
                        event.timeSlot = currentTimeSlot;
                        currentEvents.push(event);
                    }
                }
            });

            // Add final time slot
            if (currentTimeSlot && currentEvents.length > 0) {
                dayInfo.timeSlots.push({
                    time: currentTimeSlot,
                    events: [...currentEvents]
                });
            }

            dayGroups[baseDay].periods.push(dayInfo);
        });

        // Convert to array and properly merge periods with separators
        return Object.values(dayGroups).map(dayGroup => {
            const allTimeSlots = [];
            const allTracks = new Set();
            
            // Sort periods to ensure morning comes before afternoon
            const sortedPeriods = dayGroup.periods.sort((a, b) => {
                const aIsMorning = a.period.toLowerCase().includes('morning');
                const bIsMorning = b.period.toLowerCase().includes('morning');
                if (aIsMorning && !bIsMorning) return -1;
                if (!aIsMorning && bIsMorning) return 1;
                return 0;
            });
            
            sortedPeriods.forEach((period, periodIndex) => {
                // Add period separator if not the first period
                if (periodIndex > 0) {
                    allTimeSlots.push({
                        time: `── ${period.period} ──`,
                        events: [],
                        isPeriodSeparator: true
                    });
                }
                
                period.timeSlots.forEach(slot => {
                    // Merge break events
                    const mergedEvents = this.mergeBreakEvents(slot.events);
                    
                    allTimeSlots.push({
                        time: slot.time,
                        events: mergedEvents,
                        period: period.period
                    });
                    
                    mergedEvents.forEach(event => {
                        if (event.track && !event.isBreak) {
                            allTracks.add(event.track);
                        }
                    });
                });
            });

            return {
                day: dayGroup.day,
                dayId: dayGroup.dayId,
                date: dayGroup.date,
                roomInfo: dayGroup.periods.map(p => p.roomInfo).filter(r => r).join(' '),
                timeSlots: allTimeSlots,
                tracks: Array.from(allTracks).sort(),
                periods: sortedPeriods.map(p => p.period)
            };
        });
    }

    mergeBreakEvents(events) {
        const breakEvents = events.filter(event => event.isBreak);
        const nonBreakEvents = events.filter(event => !event.isBreak);
        
        if (breakEvents.length <= 1) {
            return events; // No merging needed
        }
        
        // Merge all break events into one
        const mergedBreak = {
            id: `merged-break-${Math.random().toString(36).substr(2, 9)}`,
            track: 'All',
            title: this.getMergedBreakTitle(breakEvents),
            location: this.getMergedBreakLocation(breakEvents),
            talks: [],
            isBreak: true
        };
        
        return [...nonBreakEvents, mergedBreak];
    }
    
    getMergedBreakTitle(breakEvents) {
        const titles = breakEvents.map(event => event.title);
        const uniqueTitles = [...new Set(titles)];
        
        if (uniqueTitles.length === 1) {
            return uniqueTitles[0];
        }
        
        // Common break types
        const hasBreak = titles.some(t => t.toLowerCase().includes('break'));
        const hasCoffee = titles.some(t => t.toLowerCase().includes('coffee'));
        const hasLunch = titles.some(t => t.toLowerCase().includes('lunch'));
        
        if (hasLunch) return 'Lunch Break';
        if (hasCoffee || hasBreak) return 'Coffee Break';
        
        return uniqueTitles.join(' & ');
    }
    
    getMergedBreakLocation(breakEvents) {
        const locations = breakEvents.map(event => event.location).filter(loc => loc);
        const uniqueLocations = [...new Set(locations)];
        
        if (uniqueLocations.length <= 1) {
            return uniqueLocations[0] || '';
        }
        
        return uniqueLocations.join(' / ');
    }

    parseConferenceDate(dayString) {
        // Parse strings like "Sunday 10th August", "Monday 11th August", etc.
        // This is a simple implementation - you might need to adjust based on your conference's date format
        const dayRegex = /(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)/;
        const match = dayString.match(dayRegex);
        
        if (!match) {
            console.log('Could not parse day:', dayString);
            return null;
        }
        
        const [, dayName, dayNum, monthName] = match;
        
        // Get current year (or you could extract from the schedule if available)
        const currentYear = new Date().getFullYear();
        
        // Convert month name to number
        const months = {
            'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
            'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
        };
        
        const monthIndex = months[monthName.toLowerCase()];
        if (monthIndex === undefined) {
            console.log('Unknown month:', monthName);
            return null;
        }
        
        const date = new Date(currentYear, monthIndex, parseInt(dayNum));
        console.log(`Parsed date: ${dayString} -> ${date.toDateString()}`);
        return date;
    }

    parseEventElement(eventElement) {
        const event = {
            id: `event-${Math.random().toString(36).substr(2, 9)}`,
            track: '',
            title: '',
            location: '',
            talks: [],
            isBreak: false
        };

        const titleBlock = eventElement.querySelector('.event-title-block');
        const undetailedBlock = eventElement.querySelector('.event-undetailed-block');

        if (undetailedBlock) {
            // Simple event like breaks
            event.track = undetailedBlock.querySelector('.event-track')?.textContent.trim() || '';
            event.title = undetailedBlock.querySelector('.event-title')?.textContent.trim() || '';
            event.location = undetailedBlock.querySelector('.event-loc')?.textContent.trim() || '';
            event.isBreak = event.track.toLowerCase().includes('all') || 
                           event.title.toLowerCase().includes('break') ||
                           event.title.toLowerCase().includes('lunch') ||
                           event.title.toLowerCase().includes('coffee');
        } else if (titleBlock) {
            // Session with multiple talks
            event.track = titleBlock.querySelector('.event-track')?.textContent.trim() || '';
            event.title = titleBlock.querySelector('.event-title')?.textContent.trim() || '';
            event.location = titleBlock.querySelector('.event-loc')?.textContent.trim() || '';

            // Parse individual talks
            const infoBlock = eventElement.querySelector('.event-info-block');
            if (infoBlock) {
                const talks = infoBlock.querySelectorAll('.event-info');
                talks.forEach(talk => {
                    const talkTitle = talk.querySelector('div:first-child')?.textContent.trim();
                    const authors = talk.querySelector('.eauthors')?.textContent.trim() || '';
                    const time = talk.querySelector('.etime')?.textContent.trim() || '';
                    
                    if (talkTitle) {
                        const talkId = `talk-${Math.random().toString(36).substr(2, 9)}`;
                        const talk = {
                            id: talkId,
                            title: talkTitle,
                            authors: authors,
                            time: time,
                            eventId: event.id,
                            dayId: event.dayId,
                            timeSlot: event.timeSlot,
                            track: event.track,
                            location: event.location,
                            // Add full datetime info for real-time features
                            datetime: null // Will be set later when we have day info
                        };
                        console.log('Parsed talk:', talk);
                        event.talks.push(talk);
                    }
                });
            }
        }

        return event.title ? event : null;
    }

    renderTimeline(scheduleData) {
        const container = document.getElementById('timelineContent');
        const tabsContainer = document.getElementById('dayTabs');
        
        container.innerHTML = '';
        tabsContainer.innerHTML = '';

        // Create day tabs
        scheduleData.forEach((day, index) => {
            const tab = document.createElement('button');
            tab.className = 'day-tab';
            tab.textContent = day.day;
            tab.dataset.dayId = day.dayId;
            tab.addEventListener('click', () => this.switchDay(day.dayId));
            
            if (index === 0 || day.dayId === this.activeDay) {
                tab.classList.add('active');
                this.activeDay = day.dayId;
            }
            
            tabsContainer.appendChild(tab);
        });

        // Create day content
        scheduleData.forEach(day => {
            const dayElement = this.createTimelineDay(day);
            container.appendChild(dayElement);
        });

        this.applySelections();
        this.checkConflicts();
    }

    createTimelineDay(day) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'timeline-day';
        dayDiv.id = `timeline-${day.dayId}`;
        
        if (day.dayId === this.activeDay) {
            dayDiv.classList.add('active');
        }

        const grid = document.createElement('div');
        grid.className = 'timeline-grid';
        
        const tracks = day.tracks || [];
        
        // Create track columns
        tracks.forEach(track => {
            const trackColumn = document.createElement('div');
            trackColumn.className = 'track-column';
            
            // Track header
            const header = document.createElement('div');
            header.className = 'track-column-header';
            header.textContent = track;
            trackColumn.appendChild(header);
            
            // Track events container
            const trackEvents = document.createElement('div');
            trackEvents.className = 'track-events';
            
            // Group events by time for this track
            day.timeSlots.forEach(slot => {
                // Handle period separators
                if (slot.isPeriodSeparator) {
                    const separator = document.createElement('div');
                    separator.className = 'time-header period-separator';
                    separator.textContent = slot.time;
                    trackEvents.appendChild(separator);
                    return;
                }
                
                // Get events for this track in this time slot
                const trackEventsInSlot = slot.events.filter(event => 
                    event.track === track || event.isBreak
                );
                
                if (trackEventsInSlot.length > 0) {
                    // Time header
                    const timeHeader = document.createElement('div');
                    timeHeader.className = 'time-header';
                    timeHeader.textContent = slot.time;
                    trackEvents.appendChild(timeHeader);
                    
                    // Events in this time slot
                    trackEventsInSlot.forEach(event => {
                        if (event.isBreak) {
                            // Show break event
                            const breakDiv = document.createElement('div');
                            breakDiv.className = 'break-event';
                            breakDiv.innerHTML = `
                                <div class="event-track">All</div>
                                <div class="event-title">${event.title}</div>
                                <div class="event-location">${event.location}</div>
                            `;
                            trackEvents.appendChild(breakDiv);
                        } else {
                            // Show session with talks
                            const sessionDiv = document.createElement('div');
                            sessionDiv.className = 'session-event';
                            sessionDiv.innerHTML = `
                                <div class="event-track">${event.track}</div>
                                <div class="event-title">${event.title}</div>
                                <div class="event-location">${event.location}</div>
                            `;
                            
                            // Add individual talks
                            event.talks.forEach(talk => {
                                const talkDiv = this.createTalkElement(talk);
                                sessionDiv.appendChild(talkDiv);
                            });
                            
                            trackEvents.appendChild(sessionDiv);
                        }
                    });
                }
            });
            
            trackColumn.appendChild(trackEvents);
            grid.appendChild(trackColumn);
        });

        dayDiv.appendChild(grid);
        return dayDiv;
    }

    createTalkElement(talk) {
        const talkDiv = document.createElement('div');
        talkDiv.className = 'individual-talk';
        talkDiv.dataset.talkId = talk.id;
        
        // Check if talk is in the past
        const now = new Date();
        const isPast = talk.endDateTime && talk.endDateTime < now;
        const isCurrent = talk.startDateTime && talk.endDateTime && 
                         now >= talk.startDateTime && now <= talk.endDateTime;
        
        if (isPast) {
            talkDiv.classList.add('past-talk');
        }
        
        if (isCurrent) {
            talkDiv.classList.add('current-talk');
        }
        
        // Debug: Add console log to see if clicks are registering
        talkDiv.addEventListener('click', (e) => {
            console.log('Talk clicked:', talk.title, talk.id);
            e.preventDefault();
            e.stopPropagation();
            this.toggleTalkSelection(talk.id);
        });

        // Create talk content manually to ensure proper structure
        const talkTitle = document.createElement('div');
        talkTitle.className = 'talk-title';
        talkTitle.textContent = talk.title;
        talkDiv.appendChild(talkTitle);

        if (talk.authors) {
            const talkAuthors = document.createElement('div');
            talkAuthors.className = 'talk-authors';
            talkAuthors.textContent = talk.authors;
            talkDiv.appendChild(talkAuthors);
        }

        if (talk.time) {
            const talkTime = document.createElement('div');
            talkTime.className = 'talk-time';
            talkTime.textContent = talk.time;
            
            // Add status indicator
            if (isCurrent) {
                talkTime.textContent += ' • LIVE';
                talkTime.style.color = '#dc3545';
                talkTime.style.fontWeight = 'bold';
            } else if (isPast) {
                talkTime.textContent += ' • Ended';
                talkTime.style.color = '#6c757d';
            }
            
            talkDiv.appendChild(talkTime);
        }

        const indicator = document.createElement('div');
        indicator.className = 'talk-selection-indicator';
        indicator.textContent = '✓';
        talkDiv.appendChild(indicator);

        return talkDiv;
    }

    createTimelineEvent(event, topPosition, height) {
        const eventDiv = document.createElement('div');
        eventDiv.className = 'timeline-event';
        eventDiv.dataset.eventId = event.id;
        eventDiv.style.top = `${topPosition}px`;
        eventDiv.style.height = `${height}px`;

        if (event.isBreak) {
            eventDiv.innerHTML = `
                <div class="event-track">${event.track}</div>
                <div class="event-title">${event.title}</div>
                <div class="event-location">${event.location}</div>
            `;
        } else {
            eventDiv.innerHTML = `
                <div class="event-track">${event.track}</div>
                <div class="event-title">${event.title}</div>
                <div class="event-location">${event.location}</div>
            `;

            // Add individual talks
            event.talks.forEach(talk => {
                const talkDiv = document.createElement('div');
                talkDiv.className = 'individual-talk';
                talkDiv.dataset.talkId = talk.id;
                
                // Debug: Add console log to see if clicks are registering
                talkDiv.addEventListener('click', (e) => {
                    console.log('Talk clicked:', talk.title, talk.id);
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleTalkSelection(talk.id);
                });

                // Create talk content manually to ensure proper structure
                const talkTitle = document.createElement('div');
                talkTitle.className = 'talk-title';
                talkTitle.textContent = talk.title;
                talkDiv.appendChild(talkTitle);

                if (talk.authors) {
                    const talkAuthors = document.createElement('div');
                    talkAuthors.className = 'talk-authors';
                    talkAuthors.textContent = talk.authors;
                    talkDiv.appendChild(talkAuthors);
                }

                if (talk.time) {
                    const talkTime = document.createElement('div');
                    talkTime.className = 'talk-time';
                    talkTime.textContent = talk.time;
                    talkDiv.appendChild(talkTime);
                }

                const indicator = document.createElement('div');
                indicator.className = 'talk-selection-indicator';
                indicator.textContent = '✓';
                talkDiv.appendChild(indicator);

                eventDiv.appendChild(talkDiv);
            });
        }

        return eventDiv;
    }

    switchDay(dayId) {
        this.activeDay = dayId;
        
        // Update tabs
        document.querySelectorAll('.day-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.dayId === dayId) {
                tab.classList.add('active');
            }
        });
        
        // Update day content
        document.querySelectorAll('.timeline-day').forEach(day => day.classList.remove('active'));
        const targetDay = document.getElementById(`timeline-${dayId}`);
        if (targetDay) {
            targetDay.classList.add('active');
        }
    }

    toggleTalkSelection(talkId) {
        console.log('toggleTalkSelection called with:', talkId);
        console.log('Current selected talks:', Array.from(this.selectedTalks));
        
        if (this.selectedTalks.has(talkId)) {
            this.selectedTalks.delete(talkId);
            console.log('Removed talk:', talkId);
        } else {
            this.selectedTalks.add(talkId);
            console.log('Added talk:', talkId);
        }

        console.log('New selected talks:', Array.from(this.selectedTalks));
        
        this.applySelections();
        this.checkConflicts();
        this.saveSelections();
        this.updateMySchedule();
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        if (tabName === 'browse') {
            document.getElementById('browseTab').classList.add('active');
        } else if (tabName === 'schedule') {
            document.getElementById('scheduleTab').classList.add('active');
            this.updateMySchedule(); // Refresh when switching to schedule tab
        }
    }

    updateMySchedule() {
        console.log('updateMySchedule called, selectedTalks size:', this.selectedTalks.size);
        console.log('Selected talk IDs:', Array.from(this.selectedTalks));
        
        const container = document.getElementById('myScheduleTimeline');
        const statsContainer = document.getElementById('scheduleStats');
        
        if (this.selectedTalks.size === 0) {
            console.log('No selected talks, showing empty message');
            statsContainer.textContent = '';
            container.innerHTML = '<div class="no-selections" id="noSelections"><p>No talks selected yet. Go to "Browse Schedule" tab to select talks.</p></div>';
            return;
        }
        
        // Get all selected talks (including those without datetime info)
        const selectedTalks = Array.from(this.selectedTalks)
            .map(id => {
                const talk = this.findTalkById(id);
                console.log('Finding talk with ID:', id, 'Found:', !!talk, talk ? talk.title : 'not found');
                return talk;
            })
            .filter(talk => talk);
        
        console.log('Total selected talks found:', selectedTalks.length);
        
        // Sort talks by datetime if available, otherwise by original order
        selectedTalks.sort((a, b) => {
            if (a.startDateTime && b.startDateTime) {
                return a.startDateTime - b.startDateTime;
            } else if (a.startDateTime && !b.startDateTime) {
                return -1; // Talks with datetime come first
            } else if (!a.startDateTime && b.startDateTime) {
                return 1; // Talks without datetime come last
            } else {
                return 0; // Keep original order for talks without datetime
            }
        });
        
        // Update stats
        const conflicts = this.getConflictCount();
        statsContainer.innerHTML = `
            ${selectedTalks.length} talks selected 
            ${conflicts > 0 ? `• <span style="color: #dc3545;">${conflicts} conflicts</span>` : '• <span style="color: #28a745;">No conflicts</span>'}
        `;
        
        // Group talks by actual date (not period-specific dayId)
        const talksByDay = {};
        selectedTalks.forEach(talk => {
            console.log('Grouping talk:', talk.title, 'dayId:', talk.dayId, 'dayDate:', talk.dayDate);
            
            let dayKey;
            let baseDayName;
            
            // First try to extract the base day name (without morning/afternoon)
            if (talk.dayId) {
                // Find the schedule data to get the original day name
                const schedule = this.schedules.get(this.currentScheduleId);
                if (schedule && schedule.data) {
                    const dayInfo = schedule.data.find(day => day.dayId === talk.dayId);
                    if (dayInfo && dayInfo.day) {
                        console.log('Found dayInfo.day:', dayInfo.day);
                        // Use the normalization function
                        baseDayName = this.normalizeDayName(dayInfo.day);
                        dayKey = baseDayName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
                        console.log('Normalized baseDayName:', baseDayName, 'dayKey:', dayKey);
                    }
                }
            }
            
            // Fallback to date-based grouping
            if (!dayKey) {
                if (talk.dayDate) {
                    // Use a consistent date-based key
                    dayKey = `date-${talk.dayDate.getFullYear()}-${talk.dayDate.getMonth()}-${talk.dayDate.getDate()}`;
                    baseDayName = talk.dayDate.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'long', 
                        day: 'numeric' 
                    });
                    console.log('Using date-based grouping:', dayKey, baseDayName);
                } else if (talk.dayId) {
                    // Last resort: use dayId but try to clean it up
                    baseDayName = talk.dayId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    dayKey = talk.dayId.replace(/[^\w-]/g, '');
                    console.log('Using dayId fallback:', dayKey, baseDayName);
                } else {
                    dayKey = 'unknown-day';
                    baseDayName = 'Unknown Day';
                    console.log('Using unknown day fallback');
                }
            }
            
            if (!talksByDay[dayKey]) {
                talksByDay[dayKey] = {
                    talks: [],
                    displayName: baseDayName,
                    date: talk.dayDate,
                    originalDayIds: new Set()
                };
            }
            
            // Track which original dayIds are included in this merged day
            if (talk.dayId) {
                talksByDay[dayKey].originalDayIds.add(talk.dayId);
            }
            
            talksByDay[dayKey].talks.push(talk);
        });
        
        // Debug: Show all day keys we ended up with
        console.log('Final day groups:', Object.keys(talksByDay));
        Object.entries(talksByDay).forEach(([key, data]) => {
            console.log(`Day key "${key}" -> Display: "${data.displayName}" -> ${data.talks.length} talks`);
        });
        
        // Sort talks within each day chronologically
        Object.values(talksByDay).forEach(dayData => {
            dayData.talks.sort((a, b) => {
                // First sort by datetime if available
                if (a.startDateTime && b.startDateTime) {
                    return a.startDateTime - b.startDateTime;
                }
                
                // If no datetime, try to sort by time string
                const aTime = this.parseTimeRange(a.time);
                const bTime = this.parseTimeRange(b.time);
                if (aTime && bTime) {
                    return aTime.start - bTime.start;
                }
                
                // Keep original order if can't sort by time
                return 0;
            });
        });
        
        // Generate HTML
        container.innerHTML = '';
        
        Object.entries(talksByDay).forEach(([dayKey, dayData]) => {
            const dayGroup = document.createElement('div');
            dayGroup.className = 'schedule-day-group';
            
            // Day header
            const dayHeader = document.createElement('div');
            dayHeader.className = 'schedule-day-header';
            dayHeader.textContent = dayData.displayName;
            dayGroup.appendChild(dayHeader);
            
            // Talks container
            const talksContainer = document.createElement('div');
            talksContainer.className = 'schedule-talks';
            
            dayData.talks.forEach((talk, index) => {
                const talkElement = this.createMyScheduleTalk(talk);
                talksContainer.appendChild(talkElement);
                
                // Add transition time info between consecutive talks
                if (index < dayData.talks.length - 1) {
                    const nextTalk = dayData.talks[index + 1];
                    const transitionElement = this.createTransitionInfo(talk, nextTalk);
                    if (transitionElement) {
                        talksContainer.appendChild(transitionElement);
                    }
                }
            });
            
            dayGroup.appendChild(talksContainer);
            container.appendChild(dayGroup);
        });
        
        // Add current time indicator
        this.addCurrentTimeIndicator();
        
        // Start live updates if timeline is active
        if (this.timelineActive) {
            this.updateMyScheduleStates();
        }
    }

    createMyScheduleTalk(talk) {
        const now = new Date();
        const isPast = talk.endDateTime && talk.endDateTime < now;
        const isCurrent = talk.startDateTime && talk.endDateTime && 
                         now >= talk.startDateTime && now <= talk.endDateTime;
        
        const talkDiv = document.createElement('div');
        talkDiv.className = 'schedule-talk';
        talkDiv.dataset.talkId = talk.id;
        
        if (isPast) talkDiv.classList.add('past-talk');
        if (isCurrent) talkDiv.classList.add('current-talk');
        
        // Time info
        const timeInfo = document.createElement('div');
        timeInfo.className = 'talk-time-info';
        
        const timeRange = document.createElement('div');
        timeRange.className = 'talk-time-range';
        
        let startTimeText, endTimeText;
        if (talk.startDateTime && talk.endDateTime) {
            startTimeText = talk.startDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            endTimeText = talk.endDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            timeRange.textContent = `${startTimeText} – ${endTimeText}`;
        } else if (talk.time && talk.time.includes('–')) {
            timeRange.textContent = talk.time;
        } else {
            timeRange.textContent = talk.time || 'Time TBD';
        }
        
        const duration = document.createElement('div');
        duration.className = 'talk-duration';
        if (talk.startDateTime && talk.endDateTime) {
            const durationMs = talk.endDateTime - talk.startDateTime;
            const durationMin = Math.round(durationMs / (1000 * 60));
            duration.textContent = `${durationMin} min`;
        } else {
            // Try to parse duration from time string
            const timeRange = this.parseTimeRange(talk.time);
            if (timeRange) {
                const durationMin = timeRange.end - timeRange.start;
                duration.textContent = `${durationMin} min`;
            } else {
                duration.textContent = 'Duration TBD';
            }
        }
        
        timeInfo.appendChild(timeRange);
        timeInfo.appendChild(duration);
        
        // Talk details
        const details = document.createElement('div');
        details.className = 'talk-details';
        
        const title = document.createElement('div');
        title.className = 'talk-title-main';
        title.textContent = talk.title;
        
        const authors = document.createElement('div');
        authors.className = 'talk-authors-main';
        authors.textContent = talk.authors || '';
        
        const meta = document.createElement('div');
        meta.className = 'talk-meta';
        
        const track = document.createElement('span');
        track.className = 'talk-track-main';
        track.textContent = talk.track;
        
        const location = document.createElement('span');
        location.className = 'talk-location-main';
        location.textContent = talk.location;
        
        // Status
        const status = document.createElement('span');
        status.className = 'talk-status';
        if (isCurrent) {
            status.classList.add('live');
            status.textContent = 'LIVE';
        } else if (isPast) {
            status.classList.add('ended');
            status.textContent = 'ENDED';
        } else if (talk.startDateTime) {
            status.classList.add('upcoming');
            status.textContent = 'UPCOMING';
        } else {
            status.classList.add('upcoming');
            status.textContent = 'SCHEDULED';
        }
        
        // Navigation button to go back to original location
        const navButton = document.createElement('button');
        navButton.className = 'talk-nav-button';
        navButton.textContent = '→ View in Schedule';
        navButton.title = 'Go to this talk in the Browse Schedule tab';
        navButton.onclick = (e) => {
            e.stopPropagation();
            this.navigateToTalk(talk);
        };
        
        meta.appendChild(track);
        meta.appendChild(location);
        meta.appendChild(status);
        meta.appendChild(navButton);
        
        details.appendChild(title);
        if (talk.authors) details.appendChild(authors);
        details.appendChild(meta);
        
        talkDiv.appendChild(timeInfo);
        talkDiv.appendChild(details);
        
        return talkDiv;
    }

    createTransitionInfo(currentTalk, nextTalk) {
        // Only create transition info if we have datetime information for both talks
        if (!currentTalk.endDateTime || !nextTalk.startDateTime) {
            return null;
        }
        
        const transitionMs = nextTalk.startDateTime - currentTalk.endDateTime;
        const transitionMin = Math.round(transitionMs / (1000 * 60));
        
        // Don't show transition for negative values (overlapping talks) 
        // or very long gaps (probably different sessions)
        if (transitionMin < 0 || transitionMin > 180) {
            return null;
        }
        
        const transitionDiv = document.createElement('div');
        transitionDiv.className = 'transition-info';
        
        // Add warning class for very short transitions
        if (transitionMin < 5) {
            transitionDiv.classList.add('transition-warning');
        } else if (transitionMin < 15) {
            transitionDiv.classList.add('transition-caution');
        }
        
        let transitionText;
        let locationNote = '';
        
        if (transitionMin === 0) {
            transitionText = 'Back-to-back sessions';
        } else if (transitionMin < 60) {
            transitionText = `${transitionMin} min break`;
        } else {
            const hours = Math.floor(transitionMin / 60);
            const mins = transitionMin % 60;
            transitionText = mins > 0 ? `${hours}h ${mins}min break` : `${hours}h break`;
        }
        
        // Add location change warning if different locations
        if (currentTalk.location && nextTalk.location && 
            currentTalk.location.trim() !== nextTalk.location.trim()) {
            locationNote = ` • Move from ${currentTalk.location} to ${nextTalk.location}`;
            if (transitionMin < 10) {
                locationNote += ' ⚠️';
            }
        }
        
        transitionDiv.innerHTML = `
            <div class="transition-time">${transitionText}${locationNote}</div>
        `;
        
        return transitionDiv;
    }

    navigateToTalk(talk) {
        // Switch to Browse Schedule tab
        this.switchTab('browse');
        
        // Switch to the correct day
        if (talk.dayId) {
            this.switchDay(talk.dayId);
        }
        
        // Scroll to the talk and highlight it
        setTimeout(() => {
            const talkElement = document.querySelector(`[data-talk-id="${talk.id}"]`);
            if (talkElement) {
                // Scroll to the talk
                talkElement.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'nearest'
                });
                
                // Add temporary highlight
                talkElement.classList.add('highlighted-talk');
                setTimeout(() => {
                    talkElement.classList.remove('highlighted-talk');
                }, 3000);
            }
        }, 100);
    }

    getDayDisplayName(talk) {
        // First try to get the original day name from the schedule data
        if (this.currentScheduleId) {
            const schedule = this.schedules.get(this.currentScheduleId);
            if (schedule && schedule.data) {
                const dayInfo = schedule.data.find(day => day.dayId === talk.dayId);
                if (dayInfo && dayInfo.day) {
                    return dayInfo.day;
                }
            }
        }
        
        // Fallback to date formatting
        if (talk.dayDate) {
            try {
                return talk.dayDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric' 
                });
            } catch (e) {
                // Continue to next fallback
            }
        }
        
        // Fallback to dayId formatting
        if (talk.dayId && talk.dayId !== 'unknown-day') {
            return talk.dayId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        
        return 'Unknown Day';
    }

    normalizeDayName(dayName) {
        if (!dayName) return '';
        
        // Remove common separators and special characters
        return dayName
            .split(' –')[0]      // En-dash with spaces
            .split('–')[0]       // En-dash without spaces
            .split(' -')[0]      // Hyphen with spaces
            .split('-')[0]       // Hyphen without spaces  
            .split(' •')[0]      // Bullet with spaces
            .split('•')[0]       // Bullet without spaces
            .split('◀')[0]       // Left arrow
            .split('▶')[0]       // Right arrow
            .split('←')[0]       // Left arrow
            .split('→')[0]       // Right arrow
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }

    addCurrentTimeIndicator() {
        // Remove existing time line
        document.querySelectorAll('.current-time-line').forEach(line => line.remove());
        
        const now = new Date();
        const dayGroups = document.querySelectorAll('.schedule-day-group');
        
        dayGroups.forEach(dayGroup => {
            const talks = dayGroup.querySelectorAll('.schedule-talk');
            let insertAfterIndex = -1;
            
            talks.forEach((talkElement, index) => {
                const talkId = talkElement.dataset.talkId;
                const talk = this.findTalkById(talkId);
                
                if (talk && talk.startDateTime && talk.startDateTime <= now) {
                    insertAfterIndex = index;
                }
            });
            
            // Add time line after the appropriate talk
            if (insertAfterIndex >= 0 && insertAfterIndex < talks.length) {
                const timeLine = document.createElement('div');
                timeLine.className = 'current-time-line';
                
                const talkElement = talks[insertAfterIndex];
                talkElement.insertAdjacentElement('afterend', timeLine);
            }
        });
    }

    updateMyScheduleStates() {
        const talks = document.querySelectorAll('.schedule-talk');
        const now = new Date();
        
        talks.forEach(talkElement => {
            const talkId = talkElement.dataset.talkId;
            const talk = this.findTalkById(talkId);
            
            if (talk && talk.startDateTime && talk.endDateTime) {
                const isPast = talk.endDateTime < now;
                const isCurrent = now >= talk.startDateTime && now <= talk.endDateTime;
                
                // Update classes
                talkElement.classList.remove('past-talk', 'current-talk');
                if (isPast) talkElement.classList.add('past-talk');
                if (isCurrent) talkElement.classList.add('current-talk');
                
                // Update status
                const statusElement = talkElement.querySelector('.talk-status');
                if (statusElement) {
                    statusElement.className = 'talk-status';
                    if (isCurrent) {
                        statusElement.classList.add('live');
                        statusElement.textContent = 'LIVE';
                    } else if (isPast) {
                        statusElement.classList.add('ended');
                        statusElement.textContent = 'ENDED';
                    } else {
                        statusElement.classList.add('upcoming');
                        statusElement.textContent = 'UPCOMING';
                    }
                }
            }
        });
        
        // Update time indicator
        this.addCurrentTimeIndicator();
    }

    getConflictCount() {
        const selectedTalks = Array.from(this.selectedTalks)
            .map(id => this.findTalkById(id))
            .filter(talk => talk && talk.startDateTime);
        
        let conflicts = 0;
        for (let i = 0; i < selectedTalks.length; i++) {
            for (let j = i + 1; j < selectedTalks.length; j++) {
                if (this.talksOverlap(selectedTalks[i], selectedTalks[j])) {
                    conflicts++;
                }
            }
        }
        return conflicts;
    }

    applySelections() {
        // Reset all talk styles
        document.querySelectorAll('.individual-talk').forEach(talk => {
            talk.classList.remove('selected', 'conflict');
        });

        // Apply selected styles
        this.selectedTalks.forEach(talkId => {
            const talkElement = document.querySelector(`[data-talk-id="${talkId}"]`);
            if (talkElement) {
                talkElement.classList.add('selected');
            }
        });
    }

    checkConflicts() {
        const conflicts = [];
        const selectedTalksList = Array.from(this.selectedTalks)
            .map(id => this.findTalkById(id))
            .filter(talk => talk);

        // Group talks by day
        const talksByDay = {};
        selectedTalksList.forEach(talk => {
            if (!talksByDay[talk.dayId]) {
                talksByDay[talk.dayId] = [];
            }
            talksByDay[talk.dayId].push(talk);
        });

        // Check for conflicts within each day
        Object.entries(talksByDay).forEach(([dayId, dayTalks]) => {
            for (let i = 0; i < dayTalks.length; i++) {
                for (let j = i + 1; j < dayTalks.length; j++) {
                    const talk1 = dayTalks[i];
                    const talk2 = dayTalks[j];
                    
                    if (this.talksOverlap(talk1, talk2)) {
                        // Find or create conflict group
                        let conflictGroup = conflicts.find(c => 
                            c.talks.some(t => t.id === talk1.id || t.id === talk2.id)
                        );
                        
                        if (conflictGroup) {
                            // Add to existing conflict
                            if (!conflictGroup.talks.some(t => t.id === talk1.id)) {
                                conflictGroup.talks.push(talk1);
                            }
                            if (!conflictGroup.talks.some(t => t.id === talk2.id)) {
                                conflictGroup.talks.push(talk2);
                            }
                        } else {
                            // Create new conflict group
                            conflicts.push({
                                dayId: dayId,
                                talks: [talk1, talk2]
                            });
                        }
                    }
                }
            }
        });

        // Mark conflicting talks
        document.querySelectorAll('.individual-talk').forEach(el => {
            el.classList.remove('conflict');
        });

        conflicts.forEach(conflict => {
            conflict.talks.forEach(talk => {
                const talkElement = document.querySelector(`[data-talk-id="${talk.id}"]`);
                if (talkElement) {
                    talkElement.classList.add('conflict');
                }
            });
        });

        this.displayConflicts(conflicts);
    }

    talksOverlap(talk1, talk2) {
        console.log(`Checking conflict between "${talk1.title}" (day: ${talk1.dayId}) and "${talk2.title}" (day: ${talk2.dayId})`);
        
        // First check if talks are on the same day
        if (talk1.dayId !== talk2.dayId) {
            console.log('Different days - no conflict');
            return false; // Talks on different days cannot conflict
        }
        
        // Use datetime comparison if available (more accurate)
        if (talk1.startDateTime && talk1.endDateTime && talk2.startDateTime && talk2.endDateTime) {
            const overlap = talk1.startDateTime < talk2.endDateTime && talk2.startDateTime < talk1.endDateTime;
            if (overlap) {
                console.log(`Conflict detected (datetime): ${talk1.title} vs ${talk2.title} on ${talk1.dayId}`);
            }
            return overlap;
        }
        
        // Fallback to time string parsing if datetime not available
        const time1 = this.parseTimeRange(talk1.time);
        const time2 = this.parseTimeRange(talk2.time);
        
        if (!time1 || !time2) {
            console.log('Could not parse times:', talk1.time, talk2.time);
            return false; // If we can't parse times, assume no conflict
        }

        // Check for overlap: talk1 starts before talk2 ends AND talk2 starts before talk1 ends
        const overlap = time1.start < time2.end && time2.start < time1.end;
        
        if (overlap) {
            console.log(`Conflict detected (time): ${talk1.title} (${talk1.time}) vs ${talk2.title} (${talk2.time}) on ${talk1.dayId}`);
        }
        
        return overlap;
    }

    parseTimeRange(timeString) {
        if (!timeString) return null;
        
        // Handle formats like "09:30 – 10:30", "11:20 – 11:40", "9:15 – 9:30"
        const timeRegex = /(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/;
        const match = timeString.match(timeRegex);
        
        if (!match) {
            console.log('Could not parse time:', timeString);
            return null;
        }
        
        const [, startHour, startMin, endHour, endMin] = match;
        
        // Convert to minutes since midnight for easy comparison
        const startMinutes = parseInt(startHour) * 60 + parseInt(startMin);
        const endMinutes = parseInt(endHour) * 60 + parseInt(endMin);
        
        return {
            start: startMinutes,
            end: endMinutes,
            startTime: `${startHour}:${startMin}`,
            endTime: `${endHour}:${endMin}`
        };
    }

    displayConflicts(conflicts) {
        const conflictsSection = document.getElementById('conflictsSection');
        const conflictsList = document.getElementById('conflictsList');

        if (conflicts.length === 0) {
            conflictsSection.style.display = 'none';
            return;
        }

        conflictsSection.style.display = 'block';
        conflictsList.innerHTML = '';

        conflicts.forEach((conflict, index) => {
            const conflictDiv = document.createElement('div');
            conflictDiv.className = 'conflict-item';
            
            const conflictHeader = document.createElement('div');
            conflictHeader.style.fontWeight = 'bold';
            conflictHeader.style.marginBottom = '8px';
            conflictHeader.style.color = '#dc3545';
            conflictHeader.textContent = `Conflict ${index + 1}:`;
            conflictDiv.appendChild(conflictHeader);

            conflict.talks.forEach(talk => {
                const talkInfo = document.createElement('div');
                talkInfo.style.marginLeft = '10px';
                talkInfo.style.marginBottom = '4px';
                talkInfo.innerHTML = `
                    <strong>${talk.title}</strong><br>
                    <small style="color: #6c757d;">
                        ${talk.time} • ${talk.track} • ${talk.location}
                    </small>
                `;
                conflictDiv.appendChild(talkInfo);
            });

            conflictsList.appendChild(conflictDiv);
        });
    }

    findTalkById(talkId) {
        if (!this.currentScheduleId) return null;
        
        const schedule = this.schedules.get(this.currentScheduleId);
        if (!schedule) return null;

        for (const day of schedule.data) {
            for (const timeSlot of day.timeSlots) {
                for (const event of timeSlot.events) {
                    const talk = event.talks.find(t => t.id === talkId);
                    if (talk) return talk;
                }
            }
        }
        return null;
    }

    updateCurrentTalkDisplay() {
        const currentTalkInfo = document.getElementById('currentTalkInfo');
        const nextTalkInfo = document.getElementById('nextTalkInfo');
        
        if (this.selectedTalks.size === 0) {
            currentTalkInfo.innerHTML = 'No talks selected';
            nextTalkInfo.innerHTML = 'No talks selected';
            return;
        }

        const now = new Date();
        console.log('Current time:', now.toLocaleString());
        
        const selectedTalks = Array.from(this.selectedTalks)
            .map(id => this.findTalkById(id))
            .filter(talk => talk);

        console.log('Selected talks:', selectedTalks.length);
        console.log('Selected talks with datetime:', selectedTalks.filter(t => t.startDateTime).length);
        
        // Debug: Log all selected talks with their times
        selectedTalks.forEach(talk => {
            if (talk.startDateTime) {
                console.log(`Talk: ${talk.title} | Start: ${talk.startDateTime.toLocaleString()} | End: ${talk.endDateTime.toLocaleString()}`);
            } else {
                console.log(`Talk: ${talk.title} | NO DATETIME | Time: ${talk.time}`);
            }
        });

        // Filter out talks without datetime info
        const validTalks = selectedTalks.filter(talk => talk.startDateTime);
        
        // Sort talks by start time
        validTalks.sort((a, b) => a.startDateTime - b.startDateTime);

        // Find current and next talks
        let currentTalk = null;
        let nextTalk = null;

        // First, find current talk
        for (const talk of validTalks) {
            if (now >= talk.startDateTime && now <= talk.endDateTime) {
                currentTalk = talk;
                console.log('Found current talk:', talk.title);
                break; // Only one talk can be current
            }
        }

        // Then find next future talk
        for (const talk of validTalks) {
            if (talk.startDateTime > now) {
                nextTalk = talk;
                console.log('Found next talk:', talk.title, 'at', talk.startDateTime.toLocaleString());
                break;
            }
        }

        console.log('Current talk:', currentTalk ? currentTalk.title : 'None');
        console.log('Next talk:', nextTalk ? nextTalk.title : 'None');

        // Display current talk
        if (currentTalk) {
            const timeLeft = this.formatTimeUntil(currentTalk.endDateTime, now);
            currentTalkInfo.innerHTML = `
                <div style="font-weight: bold; color: #ffffff;">${currentTalk.title}</div>
                <div style="font-size: 12px; color: #ffffff; opacity: 0.9;">${currentTalk.location} • Ends in ${timeLeft}</div>
            `;
        } else {
            currentTalkInfo.innerHTML = '<div style="color: #ffffff; opacity: 0.7;">No current talk</div>';
        }

        // Display next talk
        if (nextTalk) {
            const timeUntil = this.formatTimeUntil(nextTalk.startDateTime, now);
            const isPastTalk = nextTalk.startDateTime <= now;
            
            if (isPastTalk) {
                // This is a fallback when all talks are in the past
                nextTalkInfo.innerHTML = `
                    <div style="font-weight: bold; color: #6c757d;">${nextTalk.title}</div>
                    <div style="font-size: 12px; color: #6c757d;">${nextTalk.location} • Ended</div>
                `;
            } else {
                nextTalkInfo.innerHTML = `
                    <div style="font-weight: bold; color: #ffffff;">${nextTalk.title}</div>
                    <div style="font-size: 12px; color: #ffffff; opacity: 0.9;">${nextTalk.location} • Starts in ${timeUntil}</div>
                `;
            }
        } else {
            nextTalkInfo.innerHTML = '<div style="color: #ffffff; opacity: 0.7;">No upcoming talk</div>';
        }
    }

    formatTimeUntil(targetTime, now) {
        const diffMs = targetTime - now;
        
        if (Math.abs(diffMs) < 60000) { // Less than 1 minute
            return diffMs > 0 ? 'in 1m' : 'now';
        }
        
        const totalMinutes = Math.abs(Math.floor(diffMs / (1000 * 60)));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        
        let result = '';
        if (days > 0) {
            result = remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
        } else if (hours > 0) {
            result = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
        } else {
            result = `${minutes}m`;
        }
        
        return diffMs < 0 ? `${result} ago` : result;
    }

    toggleTimeline() {
        const button = document.getElementById('timelineToggle');
        
        if (this.timelineActive) {
            this.stopTimeline();
            button.textContent = 'Start Live Timeline';
        } else {
            this.startTimeline();
            button.textContent = 'Stop Live Timeline';
        }
    }

    startTimeline() {
        this.timelineActive = true;
        this.updateCurrentTalkDisplay();
        
        // Update every 30 seconds
        this.timelineInterval = setInterval(() => {
            this.updateTalkStates();
            this.updateMyScheduleStates();
            this.highlightCurrentEvents();
        }, 30000);
        
        this.updateTalkStates();
        this.highlightCurrentEvents();
    }

    updateTalkStates() {
        const now = new Date();
        
        // Update all talk elements with current state
        document.querySelectorAll('.individual-talk').forEach(talkElement => {
            const talkId = talkElement.dataset.talkId;
            const talk = this.findTalkById(talkId);
            
            if (talk && talk.startDateTime && talk.endDateTime) {
                const isPast = talk.endDateTime < now;
                const isCurrent = now >= talk.startDateTime && now <= talk.endDateTime;
                
                // Remove existing state classes
                talkElement.classList.remove('past-talk', 'current-talk');
                
                // Add current state
                if (isPast) {
                    talkElement.classList.add('past-talk');
                } else if (isCurrent) {
                    talkElement.classList.add('current-talk');
                }
                
                // Update time display
                const timeElement = talkElement.querySelector('.talk-time');
                if (timeElement) {
                    // Reset to base time text
                    timeElement.textContent = talk.time;
                    timeElement.style.color = '';
                    timeElement.style.fontWeight = '';
                    
                    // Add status
                    if (isCurrent) {
                        timeElement.textContent += ' • LIVE';
                        timeElement.style.color = '#dc3545';
                        timeElement.style.fontWeight = 'bold';
                    } else if (isPast) {
                        timeElement.textContent += ' • Ended';
                        timeElement.style.color = '#6c757d';
                    }
                }
            }
        });
    }

    stopTimeline() {
        this.timelineActive = false;
        if (this.timelineInterval) {
            clearInterval(this.timelineInterval);
            this.timelineInterval = null;
        }
        
        // Remove current-time highlighting
        document.querySelectorAll('.current-time').forEach(el => {
            el.classList.remove('current-time');
        });
    }

    highlightCurrentEvents() {
        if (!this.timelineActive) return;

        // Remove previous highlights
        document.querySelectorAll('.current-time').forEach(el => {
            el.classList.remove('current-time');
        });

        // Highlight current events (simplified implementation)
        const selectedTalkElements = document.querySelectorAll('.individual-talk.selected');
        if (selectedTalkElements.length > 0) {
            selectedTalkElements[0].closest('.timeline-event')?.classList.add('current-time');
        }
    }

    clearSelections() {
        this.selectedTalks.clear();
        this.applySelections();
        this.checkConflicts();
        this.saveSelections();
        this.updateCurrentTalkDisplay();
    }

    showStatus(message, type) {
        const statusElement = document.getElementById('importStatus');
        statusElement.textContent = message;
        statusElement.className = `status-${type}`;
        statusElement.style.display = 'block';
        
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 5000);
    }

    checkForSharedSchedule() {
        const urlParams = new URLSearchParams(window.location.search);
        const sharedData = urlParams.get('schedule');
        
        if (sharedData) {
            try {
                const decodedData = this.decodeSharedSchedule(sharedData);
                this.importSharedSchedule(decodedData);
            } catch (error) {
                console.error('Error loading shared schedule:', error);
                this.showStatus('Invalid or corrupted shared schedule link', 'error');
            }
        }
    }

    decodeSharedSchedule(encodedData) {
        try {
            // Try to decode base64 and decompress
            const compressed = atob(encodedData);
            const decompressed = this.decompress(compressed);
            return JSON.parse(decompressed);
        } catch (error) {
            console.error('Decoding failed, trying fallback:', error);
            try {
                // Fallback: try simple base64 decode without decompression
                const decoded = atob(encodedData);
                return JSON.parse(decoded);
            } catch (fallbackError) {
                console.error('Fallback decoding also failed:', fallbackError);
                throw new Error('Unable to decode shared schedule data');
            }
        }
    }

    encodeSharedSchedule(data) {
        try {
            // Compress and encode to base64
            const jsonString = JSON.stringify(data);
            const compressed = this.compress(jsonString);
            return btoa(compressed);
        } catch (error) {
            console.error('Encoding failed:', error);
            // Fallback to simple base64 encoding without compression
            return btoa(JSON.stringify(data));
        }
    }

    compress(str) {
        try {
            // Simple compression using string replacements for common patterns
            return str
                .replace(/{"id"/g, '{"i"')
                .replace(/,"title"/g, ',"t"')
                .replace(/,"authors"/g, ',"a"')
                .replace(/,"time"/g, ',"tm"')
                .replace(/,"track"/g, ',"tr"')
                .replace(/,"location"/g, ',"l"')
                .replace(/,"dayId"/g, ',"d"')
                .replace(/,"startDateTime"/g, ',"s"')
                .replace(/,"endDateTime"/g, ',"e"');
        } catch (error) {
            console.error('Compression failed:', error);
            return str;
        }
    }

    decompress(str) {
        // Reverse the compression
        return str
            .replace(/{"i"/g, '{"id"')
            .replace(/,"t"/g, ',"title"')
            .replace(/,"a"/g, ',"authors"')
            .replace(/,"tm"/g, ',"time"')
            .replace(/,"tr"/g, ',"track"')
            .replace(/,"l"/g, ',"location"')
            .replace(/,"d"/g, ',"dayId"')
            .replace(/,"s"/g, ',"startDateTime"')
            .replace(/,"e"/g, ',"endDateTime"');
    }

    shareSchedule() {
        if (!this.currentScheduleId || this.selectedTalks.size === 0) {
            this.showStatus('No schedule or talks selected to share', 'error');
            return;
        }

        const schedule = this.schedules.get(this.currentScheduleId);
        const selectedTalks = Array.from(this.selectedTalks)
            .map(id => this.findTalkById(id))
            .filter(talk => talk);

        const shareData = {
            scheduleName: schedule.name,
            talks: selectedTalks.map(talk => ({
                id: talk.id,
                title: talk.title,
                authors: talk.authors || '',
                time: talk.time,
                track: talk.track,
                location: talk.location,
                dayId: talk.dayId,
                startDateTime: talk.startDateTime ? talk.startDateTime.toISOString() : null,
                endDateTime: talk.endDateTime ? talk.endDateTime.toISOString() : null
            }))
        };

        try {
            const encoded = this.encodeSharedSchedule(shareData);
            const shareUrl = `${window.location.origin}${window.location.pathname}?schedule=${encoded}`;
            
            // Show modal with share options
            this.showShareModal(shareUrl, shareData);
        } catch (error) {
            console.error('Error creating share URL:', error);
            this.showStatus('Error creating shareable link', 'error');
        }
    }

    showShareModal(shareUrl, shareData) {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'share-modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const modalContent = document.createElement('div');
        modalContent.className = 'share-modal-content';
        modalContent.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        `;

        modalContent.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0;">Share Your Schedule</h3>
                <button id="closeShareModal" style="background: none; border: none; font-size: 20px; cursor: pointer;">&times;</button>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4>Schedule: ${shareData.scheduleName}</h4>
                <p>${shareData.talks.length} selected talks</p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Shareable URL:</label>
                <div style="display: flex; gap: 10px;">
                    <input type="text" id="shareUrl" value="${shareUrl}" readonly style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <button id="copyUrlBtn" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Copy</button>
                </div>
                <small style="color: #666; margin-top: 5px; display: block;">Share this URL with others to let them see your selected talks</small>
            </div>
            
            <div style="margin-bottom: 20px;">
                <button id="downloadScheduleBtn" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">Download Schedule File</button>
                <small style="color: #666; margin-left: 10px;">Save as file for backup or sharing</small>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 15px;">
                <h5>Selected Talks Preview:</h5>
                <div style="max-height: 200px; overflow-y: auto; border: 1px solid #eee; padding: 10px; border-radius: 4px; background: #f8f9fa;">
                    ${shareData.talks.map(talk => `
                        <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #eee;">
                            <strong>${talk.title}</strong><br>
                            <small>${talk.time || 'Time TBD'} • ${talk.track} • ${talk.location}</small>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Event listeners
        document.getElementById('closeShareModal').onclick = () => document.body.removeChild(modal);
        modal.onclick = (e) => {
            if (e.target === modal) document.body.removeChild(modal);
        };

        document.getElementById('copyUrlBtn').onclick = async () => {
            const urlInput = document.getElementById('shareUrl');
            const copyBtn = document.getElementById('copyUrlBtn');
            
            try {
                // Try modern Clipboard API first
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(urlInput.value);
                } else {
                    // Fallback for older browsers or non-secure contexts
                    urlInput.select();
                    urlInput.setSelectionRange(0, 99999); // For mobile devices
                    document.execCommand('copy');
                }
                
                copyBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy';
                }, 2000);
            } catch (err) {
                console.error('Failed to copy: ', err);
                // Fallback: select the text so user can manually copy
                urlInput.select();
                urlInput.setSelectionRange(0, 99999);
                copyBtn.textContent = 'Select & Copy';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy';
                }, 3000);
            }
        };

        document.getElementById('downloadScheduleBtn').onclick = () => {
            this.downloadScheduleFile(shareData);
        };
    }

    downloadScheduleFile(shareData) {
        const dataStr = JSON.stringify(shareData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${shareData.scheduleName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_schedule.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    exportSchedule() {
        if (!this.currentScheduleId || this.selectedTalks.size === 0) {
            this.showStatus('No schedule or talks selected to export', 'error');
            return;
        }

        const schedule = this.schedules.get(this.currentScheduleId);
        const selectedTalks = Array.from(this.selectedTalks)
            .map(id => this.findTalkById(id))
            .filter(talk => talk);

        const exportData = {
            scheduleName: schedule.name,
            exportedAt: new Date().toISOString(),
            talks: selectedTalks.map(talk => ({
                id: talk.id,
                title: talk.title,
                authors: talk.authors || '',
                time: talk.time,
                track: talk.track,
                location: talk.location,
                dayId: talk.dayId,
                startDateTime: talk.startDateTime ? talk.startDateTime.toISOString() : null,
                endDateTime: talk.endDateTime ? talk.endDateTime.toISOString() : null
            }))
        };

        this.downloadScheduleFile(exportData);
        this.showStatus(`Exported ${selectedTalks.length} talks to file`, 'success');
    }

    importScheduleFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const scheduleData = JSON.parse(e.target.result);
                        this.importSharedSchedule(scheduleData);
                    } catch (error) {
                        console.error('Error parsing schedule file:', error);
                        this.showStatus('Invalid schedule file format', 'error');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    importSharedSchedule(scheduleData) {
        if (!scheduleData || !scheduleData.talks || !Array.isArray(scheduleData.talks)) {
            this.showStatus('Invalid schedule data format', 'error');
            return;
        }

        // Check if we have a current schedule to import into
        if (!this.currentScheduleId) {
            this.showStatus('Please select or create a schedule first before importing talks', 'error');
            return;
        }

        const schedule = this.schedules.get(this.currentScheduleId);
        if (!schedule) {
            this.showStatus('Current schedule not found', 'error');
            return;
        }

        // Find matching talks in the current schedule
        const importedTalkIds = new Set();
        let matchedTalks = 0;
        let unmatchedTalks = 0;

        scheduleData.talks.forEach(sharedTalk => {
            // Try to find matching talk by title and time
            const matchingTalk = this.findTalkByTitleAndTime(sharedTalk.title, sharedTalk.time);
            
            if (matchingTalk) {
                importedTalkIds.add(matchingTalk.id);
                matchedTalks++;
            } else {
                unmatchedTalks++;
                console.log('Could not match talk:', sharedTalk.title, sharedTalk.time);
            }
        });

        // Update selections
        if (matchedTalks > 0) {
            // Clear existing selections and add imported ones
            this.selectedTalks = importedTalkIds;
            this.saveSelections();
            this.applySelections();
            this.checkConflicts();
            this.updateMySchedule();
            
            let message = `Imported ${matchedTalks} talks`;
            if (unmatchedTalks > 0) {
                message += ` (${unmatchedTalks} talks could not be matched in current schedule)`;
            }
            this.showStatus(message, matchedTalks > 0 ? 'success' : 'warning');
            
            // Switch to schedule view
            this.switchTab('schedule');
        } else {
            this.showStatus('No matching talks found in current schedule', 'error');
        }
    }

    findTalkByTitleAndTime(title, time) {
        if (!this.currentScheduleId) return null;
        
        const schedule = this.schedules.get(this.currentScheduleId);
        if (!schedule) return null;

        for (const day of schedule.data) {
            for (const timeSlot of day.timeSlots) {
                for (const event of timeSlot.events) {
                    const talk = event.talks.find(t => 
                        t.title.toLowerCase() === title.toLowerCase() &&
                        t.time === time
                    );
                    if (talk) return talk;
                }
            }
        }

        // Fallback: try matching by title only
        for (const day of schedule.data) {
            for (const timeSlot of day.timeSlots) {
                for (const event of timeSlot.events) {
                    const talk = event.talks.find(t => 
                        t.title.toLowerCase() === title.toLowerCase()
                    );
                    if (talk) return talk;
                }
            }
        }
        
        return null;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new ConferenceSchedulePlanner();
});