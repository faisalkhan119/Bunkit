// Deep Link Class Import Feature
// Check for class import from shared URL
function checkForClassImport() {
    const urlParams = new URLSearchParams(window.location.search);
    const classData = urlParams.get('class');
    
    if (classData) {
        // Store for import after onboarding completes
        sessionStorage.setItem('pendingClassImport', classData);
        
        // Clean URL without reload
        const cleanUrl = window.location.origin + window.location.pathname;
        history.replaceState({}, '', cleanUrl);
        
        console.log('📥 Class import pending from shared link');
    }
}

// Import class from URL encoded data
function importClassFromURL(encodedData) {
    try {
        // Decode base64 class data
        const classData = JSON.parse(atob(encodedData));
        const className = classData.name || 'Imported Class';
        
        console.log('📥 Importing class:', className);
        
        // Check if class already exists
        if (classes[className]) {
            // Add suffix to avoid overwriting
            let newName = className;
            let counter = 1;
            while (classes[newName]) {
                newName = className + ' (' + counter + ')';
                counter++;
            }
            classData.name = newName;
        }
        
        const finalClassName = classData.name || className;
        
        // Prepare class object
        const newClass = {
            subjects: classData.subjects || [],
            holidays: classData.holidays || [],
            timetable: classData.timetable || {},
            periodTimes: classData.periodTimes || {},
            lastDate: classData.lastDate || new Date().toISOString().split('T')[0]
        };
        
        // Add to classes object
        classes[finalClassName] = newClass;
        
        // Save to storage
        saveToStorage();
        
        // Mark onboarding complete
        localStorage.setItem('hasCompletedOnboarding', 'true');
        
        // Clear pending import
        sessionStorage.removeItem('pendingClassImport');
        
        // Set as current class
        localStorage.setItem('lastOpenedClass', finalClassName);
        
        // Show success and reload
        showToast('🎉 Welcome! "' + finalClassName + '" has been added!', 'success');
        setTimeout(function() { location.reload(); }, 1500);
        
    } catch (error) {
        console.error('Failed to import class:', error);
        showToast('❌ Failed to import class. Please try again.', 'error');
        sessionStorage.removeItem('pendingClassImport');
        
        // Fallback to normal onboarding
        setTimeout(function() { openOnboardingClassModal(); }, 500);
    }
}

// Handle existing users who click shared link
function handlePendingImportForExistingUser() {
    const pendingClass = sessionStorage.getItem('pendingClassImport');
    const hasCompletedOnboarding = localStorage.getItem('hasCompletedOnboarding');
    
    if (pendingClass && hasCompletedOnboarding) {
        // Existing user clicked shared link - import directly
        importClassFromURL(pendingClass);
    }
}

// Copy class share link to clipboard
function copyClassLink() {
    const selector = document.getElementById('classSelector');
    const currentClassName = selector ? selector.value : null;
    
    if (!currentClassName || !classes[currentClassName]) {
        showToast('❌ Please select a class first', 'error');
        return;
    }
    
    const currentClass = classes[currentClassName];
    const classData = {
        name: currentClassName,
        subjects: currentClass.subjects || [],
        holidays: currentClass.holidays || [],
        timetable: currentClass.timetable || {},
        periodTimes: currentClass.periodTimes || {}
    };
    
    const encodedData = btoa(JSON.stringify(classData));
    const shareUrl = 'https://bunkitapp.in/?class=' + encodedData;
    
    navigator.clipboard.writeText(shareUrl).then(function() {
        showToast('🔗 Link copied! Share it with your friends.', 'success');
    }).catch(function() {
        showToast('❌ Failed to copy link', 'error');
    });
}

