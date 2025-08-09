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
        this.enrichWithDateTimes(schedule.data);
        this.renderTimeline(schedule.data);
        this.updateMySchedule();
        this.updateTalkStates();
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
                            
                            console.log(`Enriched talk: ${talk.title} | ${talk.time} -> ${startDateTime.toLocaleString()} to ${endDateTime.toLocaleString()}`);
                        } else {
                            console.log(`Could not enrich talk: ${talk.title} | Time: ${talk.time} | TimeRange: ${timeRange ? 'OK' : 'FAILED'} | Day Date: ${day.date ? 'OK' : 'FAILED'}`);
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
        
        // Group talks by day
        const talksByDay = {};
        selectedTalks.forEach(talk => {
            let dayKey;
            if (talk.dayDate) {
                dayKey = talk.dayDate.toDateString();
            } else if (talk.dayId) {
                // Use dayId as fallback if no date available
                dayKey = talk.dayId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            } else {
                dayKey = 'Unknown Day';
            }
            
            if (!talksByDay[dayKey]) {
                talksByDay[dayKey] = [];
            }
            talksByDay[dayKey].push(talk);
        });
        
        // Generate HTML
        container.innerHTML = '';
        
        Object.entries(talksByDay).forEach(([dayKey, dayTalks]) => {
            const dayGroup = document.createElement('div');
            dayGroup.className = 'schedule-day-group';
            
            // Day header
            const dayHeader = document.createElement('div');
            dayHeader.className = 'schedule-day-header';
            
            let displayName;
            if (dayKey === 'Unknown Day') {
                displayName = dayKey;
            } else if (dayKey.includes(' ')) {
                // It's already a formatted day name like "Sunday 10Th August"
                displayName = dayKey;
            } else {
                // It's a date string, format it nicely
                try {
                    displayName = new Date(dayKey).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'long', 
                        day: 'numeric' 
                    });
                } catch (e) {
                    displayName = dayKey;
                }
            }
            
            dayHeader.textContent = displayName;
            dayGroup.appendChild(dayHeader);
            
            // Talks container
            const talksContainer = document.createElement('div');
            talksContainer.className = 'schedule-talks';
            
            dayTalks.forEach(talk => {
                const talkElement = this.createMyScheduleTalk(talk);
                talksContainer.appendChild(talkElement);
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
        
        const startTime = document.createElement('div');
        startTime.className = 'talk-start-time';
        if (talk.startDateTime) {
            startTime.textContent = talk.startDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        } else if (talk.time && talk.time.includes('–')) {
            startTime.textContent = talk.time.split(' –')[0].trim();
        } else {
            startTime.textContent = talk.time || 'Time TBD';
        }
        
        const duration = document.createElement('div');
        duration.className = 'talk-duration';
        if (talk.startDateTime && talk.endDateTime) {
            const durationMs = talk.endDateTime - talk.startDateTime;
            const durationMin = Math.round(durationMs / (1000 * 60));
            duration.textContent = `${durationMin}min`;
        } else if (talk.time) {
            duration.textContent = talk.time;
        } else {
            duration.textContent = 'Duration TBD';
        }
        
        timeInfo.appendChild(startTime);
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
        // First check if talks are on the same day
        if (talk1.dayId !== talk2.dayId) {
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
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new ConferenceSchedulePlanner();
});