const FLOORS = 10;

async function fetchState() {
    try {
        const response = await fetch('/api/state');
        if (!response.ok) throw new Error('Network error');
        const data = await response.json();
        return data;
    } catch (err) {
        console.error('Failed to fetch state:', err);
        return null;
    }
}

function drawBuilding(state) {
    const building = document.getElementById('building');
    building.innerHTML = '';

    if (!state) return;

    const elevatorsCount = state.elevators.length;

    for (let floor = state.floors; floor >= 1; floor--) {
        const floorDiv = document.createElement('div');
        floorDiv.className = 'floor';

        const floorNumSpan = document.createElement('span');
        floorNumSpan.className = 'floor-num';
        floorNumSpan.textContent = floor;
        floorDiv.appendChild(floorNumSpan);

        const shaftDiv = document.createElement('div');
        shaftDiv.className = 'elevator-shaft';

        state.elevators.forEach(elev => {
            const elevDiv = document.createElement('div');
            elevDiv.className = 'elevator';
            elevDiv.style.width = `${90 / elevatorsCount}%`;
            if (elev.currentFloor === floor) {
                elevDiv.textContent = `🚪 ${elev.id}`;
                elevDiv.style.background = elev.doorsOpen ? '#2ecc71' : '#4a90e2';
            } else {
                elevDiv.textContent = '';
                elevDiv.style.background = '#dee2e6';
                elevDiv.style.opacity = '0.3';
            }
            shaftDiv.appendChild(elevDiv);
        });
        
        floorDiv.appendChild(shaftDiv);
        
        const callBtn = document.createElement('button');
        callBtn.className = 'call-btn';
        callBtn.textContent = 'Call';
        callBtn.dataset.floor = floor;
        callBtn.addEventListener('click', () => callElevator(floor));
        floorDiv.appendChild(callBtn);
        
        building.appendChild(floorDiv);
    }
}

async function callElevator(floor) {
    try {
        const response = await fetch('/api/call', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ floor: floor }),
        });
        if (!response.ok) throw new Error('Call failed');
        console.log(`Called elevator to floor ${floor}`);
        showToast(`Called elevator to floor ${floor} (mock)`);
    } catch (err) {
        console.error('Call error:', err);
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = '#333';
    toast.style.color = 'white';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '5px';
    toast.style.zIndex = '1000';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

async function updateUI() {
    const state = await fetchState();
    if (state) {
        drawBuilding(state);
    }
}

setInterval(updateUI, 2000);
updateUI();