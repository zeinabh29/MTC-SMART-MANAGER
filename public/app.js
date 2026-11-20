// =====================================================
// MTC SMART MANAGER - CLIENT CONTROLLER & UI APP
// Pixel-Perfect Interactive Telecom Experience
// =====================================================

const API_BASE = ''; // Same-origin REST API

const state = {
    currentUser: null,
    allUsers: [],
    packages: [],
    currentScreen: 'authScreen',
    enteredPin: '',
    pinMasked: false,
    autoLockTimerId: null,
    inactivitySeconds: 0
};

// =====================================================
// DOM ELEMENTS
// =====================================================
const clockTime = document.getElementById('clockTime');

// Screens
const authScreen = document.getElementById('authScreen');
const homeScreen = document.getElementById('homeScreen');
const packagesScreen = document.getElementById('packagesScreen');
const activityScreen = document.getElementById('activityScreen');
const settingsScreen = document.getElementById('settingsScreen');
const bottomNavBar = document.getElementById('bottomNavBar');

// Auth elements
const userSelector = document.getElementById('userSelector');
const pinDisplay = document.getElementById('pinDisplay');
const pinEyeBtn = document.getElementById('pinEyeBtn');
const loginSubmitBtn = document.getElementById('loginSubmitBtn');
const loginBtnText = document.getElementById('loginBtnText');

// Home elements
const homeUserName = document.getElementById('homeUserName');
const homeUserPhone = document.getElementById('homeUserPhone');
const homeTotalBalance = document.getElementById('homeTotalBalance');
const homeDataBalance = document.getElementById('homeDataBalance');
const homeMinutesBalance = document.getElementById('homeMinutesBalance');
const bellBadgeDot = document.getElementById('bellBadgeDot');

// Modals
const rechargeModal = document.getElementById('rechargeModal');
const transferModal = document.getElementById('transferModal');
const convertModal = document.getElementById('convertModal');
const receiptModal = document.getElementById('receiptModal');
const securityModal = document.getElementById('securityModal');
const alertsModal = document.getElementById('alertsModal');

// Toast
const toastContainer = document.getElementById('toastContainer');

// =====================================================
// INITIALIZATION
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
    updateClock();
    setInterval(updateClock, 1000);

    initKeypad();
    initNavigation();
    initModals();
    initSettingsListeners();
    initActivityListeners();
    initIdleDetection();

    await loadInitialData();
});

function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    if (clockTime) clockTime.textContent = `${hours}:${minutes}`;
}

async function loadInitialData() {
    try {
        const res = await fetch(`${API_BASE}/api/users`);
        const data = await res.json();
        if (data.success && data.users.length > 0) {
            state.allUsers = data.users;
            populateUserSelector();
            selectUser(1);
        }
    } catch (err) {
        console.error('Failed to load initial users:', err);
    }
}

function populateUserSelector() {
    if (!userSelector) return;
    userSelector.innerHTML = '';
    state.allUsers.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.user_id;
        opt.textContent = `${u.full_name} (${u.phone_number})`;
        userSelector.appendChild(opt);
    });

    userSelector.addEventListener('change', (e) => {
        selectUser(parseInt(e.target.value, 10));
    });
}

function selectUser(userId) {
    const user = state.allUsers.find(u => u.user_id === userId);
    if (user) {
        state.currentUser = user;
        if (userSelector) userSelector.value = userId;
    }
}

// =====================================================
// AUTHENTICATION & PIN
// =====================================================
function initKeypad() {
    document.querySelectorAll('.num-key[data-key]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (state.enteredPin.length < 4) {
                state.enteredPin += btn.dataset.key;
                renderPinDisplay();
            }
        });
    });

    const keypadClear = document.getElementById('keypadClear');
    if (keypadClear) {
        keypadClear.addEventListener('click', () => {
            state.enteredPin = '';
            renderPinDisplay();
        });
    }

    const keypadBack = document.getElementById('keypadBack');
    if (keypadBack) {
        keypadBack.addEventListener('click', () => {
            state.enteredPin = state.enteredPin.slice(0, -1);
            renderPinDisplay();
        });
    }

    if (pinEyeBtn) {
        pinEyeBtn.addEventListener('click', () => {
            state.pinMasked = !state.pinMasked;
            renderPinDisplay();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (state.currentScreen !== 'authScreen') return;
        if (/^[0-9]$/.test(e.key)) {
            if (state.enteredPin.length < 4) {
                state.enteredPin += e.key;
                renderPinDisplay();
            }
        } else if (e.key === 'Backspace') {
            state.enteredPin = state.enteredPin.slice(0, -1);
            renderPinDisplay();
        } else if (e.key === 'Enter') {
            if (state.enteredPin.length === 4) handleLoginSubmit();
        }
    });

    if (loginSubmitBtn) {
        loginSubmitBtn.addEventListener('click', handleLoginSubmit);
    }
}

function renderPinDisplay() {
    if (!pinDisplay) return;

    if (state.enteredPin.length === 0) {
        pinDisplay.textContent = '00|00';
        pinDisplay.style.color = '#64748b';
        if (loginBtnText) loginBtnText.textContent = 'Enter 4 Digits';
        return;
    }

    let formatted = '';
    for (let i = 0; i < state.enteredPin.length; i++) {
        formatted += state.pinMasked ? '•' : state.enteredPin[i];
    }
    for (let i = state.enteredPin.length; i < 4; i++) {
        formatted += '•';
    }

    pinDisplay.textContent = `${formatted.slice(0, 2)}|${formatted.slice(2, 4)}`;
    pinDisplay.style.color = '#ffffff';

    if (state.enteredPin.length === 4) {
        if (loginBtnText) loginBtnText.textContent = 'Login';
    } else {
        if (loginBtnText) loginBtnText.textContent = `${4 - state.enteredPin.length} Digits Left`;
    }
}

async function handleLoginSubmit() {
    const pin = state.enteredPin || '1234';
    const userId = state.currentUser ? state.currentUser.user_id : 1;

    try {
        const res = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, pin })
        });

        const data = await res.json();
        if (data.success) {
            state.currentUser = data.user;
            showToast('Authenticated Successfully', 'success');
            showScreen('homeScreen');
            updateHomeView();
            resetInactivity();
        } else {
            showToast(data.message || 'Invalid PIN', 'error');
            state.enteredPin = '';
            renderPinDisplay();
        }
    } catch (err) {
        showToast('Connection error during login', 'error');
    }
}

// =====================================================
// SCREEN NAVIGATION
// =====================================================
function initNavigation() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const screenId = tab.dataset.screen;
            showScreen(screenId);
        });
    });

    const btnPackagesBack = document.getElementById('btnPackagesBack');
    if (btnPackagesBack) {
        btnPackagesBack.addEventListener('click', () => showScreen('homeScreen'));
    }

    const lockAppBtn = document.getElementById('lockAppBtn');
    if (lockAppBtn) {
        lockAppBtn.addEventListener('click', () => {
            lockApp();
        });
    }

    const openSecurityModalBtn = document.getElementById('openSecurityModalBtn');
    if (openSecurityModalBtn) {
        openSecurityModalBtn.addEventListener('click', openSecurityModal);
    }

    const openAlertsModalBtn = document.getElementById('openAlertsModalBtn');
    if (openAlertsModalBtn) {
        openAlertsModalBtn.addEventListener('click', openAlertsModal);
    }
}

function showScreen(screenId) {
    const screens = [authScreen, homeScreen, packagesScreen, activityScreen, settingsScreen];
    screens.forEach(s => {
        if (s) s.classList.add('hidden');
    });

    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');

    state.currentScreen = screenId;

    if (screenId === 'authScreen') {
        bottomNavBar.classList.add('hidden');
    } else {
        bottomNavBar.classList.remove('hidden');
    }

    document.querySelectorAll('.nav-tab').forEach(tab => {
        if (tab.dataset.screen === screenId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    if (screenId === 'homeScreen') updateHomeView();
    if (screenId === 'packagesScreen') loadPackages();
    if (screenId === 'activityScreen') loadActivityView();
    if (screenId === 'settingsScreen') loadSettingsView();
}

function lockApp() {
    state.enteredPin = '';
    renderPinDisplay();
    showToast('App Locked', 'info');
    showScreen('authScreen');
}

// =====================================================
// HOME SCREEN
// =====================================================
async function updateHomeView() {
    if (!state.currentUser) return;

    try {
        const res = await fetch(`${API_BASE}/api/user/${state.currentUser.user_id}`);
        const data = await res.json();
        if (data.success) {
            state.currentUser = data.user;
        }
    } catch (err) {
        console.error('Error fetching user:', err);
    }

    const u = state.currentUser;
    if (homeUserName) homeUserName.textContent = u.full_name;
    if (homeUserPhone) homeUserPhone.textContent = u.phone_number;
    if (homeTotalBalance) homeTotalBalance.textContent = u.balance.toFixed(2);
    if (homeDataBalance) homeDataBalance.textContent = `${(u.data_balance_gb || 3.0).toFixed(1)} GB`;
    if (homeMinutesBalance) homeMinutesBalance.textContent = `${u.minutes_balance || 450} min`;

    try {
        const alertsRes = await fetch(`${API_BASE}/api/alerts/${u.user_id}`);
        const alertsData = await alertsRes.json();
        if (alertsData.success && bellBadgeDot) {
            const hasUnread = alertsData.alerts.some(a => !a.is_read);
            if (hasUnread) bellBadgeDot.classList.add('show');
            else bellBadgeDot.classList.remove('show');
        }
    } catch (e) {}
}

// =====================================================
// QUICK ACTIONS & MODALS
// =====================================================
function initModals() {
    const btnActionRecharge = document.getElementById('btnActionRecharge');
    const closeRechargeModalBtn = document.getElementById('closeRechargeModalBtn');

    if (btnActionRecharge) {
        btnActionRecharge.addEventListener('click', () => {
            rechargeModal.classList.remove('hidden');
        });
    }
    if (closeRechargeModalBtn) {
        closeRechargeModalBtn.addEventListener('click', () => {
            rechargeModal.classList.add('hidden');
        });
    }

    document.querySelectorAll('.recharge-amount-card').forEach(btn => {
        btn.addEventListener('click', async () => {
            const amount = parseFloat(btn.dataset.amount);
            await executeRecharge(amount);
        });
    });

    const btnActionTransfer = document.getElementById('btnActionTransfer');
    const closeTransferModalBtn = document.getElementById('closeTransferModalBtn');
    const transferAmountInput = document.getElementById('transferAmountInput');
    const recipientSelect = document.getElementById('recipientSelect');
    const recipientPhoneInput = document.getElementById('recipientPhoneInput');
    const confirmTransferBtn = document.getElementById('confirmTransferBtn');

    if (btnActionTransfer) {
        btnActionTransfer.addEventListener('click', () => {
            populateTransferModal();
            transferModal.classList.remove('hidden');
        });
    }
    if (closeTransferModalBtn) {
        closeTransferModalBtn.addEventListener('click', () => {
            transferModal.classList.add('hidden');
        });
    }

    if (transferAmountInput) {
        transferAmountInput.addEventListener('input', updateTransferPreview);
    }

    if (recipientSelect) {
        recipientSelect.addEventListener('change', () => {
            if (recipientPhoneInput) recipientPhoneInput.value = recipientSelect.value;
            updateTransferPreview();
        });
    }

    if (confirmTransferBtn) {
        confirmTransferBtn.addEventListener('click', executeTransfer);
    }

    const btnActionConvert = document.getElementById('btnActionConvert');
    const closeConvertModalBtn = document.getElementById('closeConvertModalBtn');
    const convertSlider = document.getElementById('convertSlider');
    const submitConvertBtn = document.getElementById('submitConvertBtn');

    if (btnActionConvert) {
        btnActionConvert.addEventListener('click', () => {
            convertModal.classList.remove('hidden');
            updateConvertPreview();
        });
    }
    if (closeConvertModalBtn) {
        closeConvertModalBtn.addEventListener('click', () => {
            convertModal.classList.add('hidden');
        });
    }
    if (convertSlider) {
        convertSlider.addEventListener('input', updateConvertPreview);
    }
    if (submitConvertBtn) {
        submitConvertBtn.addEventListener('click', executeConversion);
    }

    const btnActionPackages = document.getElementById('btnActionPackages');
    if (btnActionPackages) {
        btnActionPackages.addEventListener('click', () => {
            showScreen('packagesScreen');
        });
    }

    const closeReceiptModalBtn = document.getElementById('closeReceiptModalBtn');
    const receiptDoneBtn = document.getElementById('receiptDoneBtn');
    if (closeReceiptModalBtn) {
        closeReceiptModalBtn.addEventListener('click', () => receiptModal.classList.add('hidden'));
    }
    if (receiptDoneBtn) {
        receiptDoneBtn.addEventListener('click', () => {
            receiptModal.classList.add('hidden');
            updateHomeView();
        });
    }

    const closeSecurityModalBtn = document.getElementById('closeSecurityModalBtn');
    if (closeSecurityModalBtn) {
        closeSecurityModalBtn.addEventListener('click', () => securityModal.classList.add('hidden'));
    }

    const closeAlertsModalBtn = document.getElementById('closeAlertsModalBtn');
    if (closeAlertsModalBtn) {
        closeAlertsModalBtn.addEventListener('click', () => alertsModal.classList.add('hidden'));
    }
}

async function executeRecharge(amount) {
    if (!state.currentUser) return;
    try {
        const res = await fetch(`${API_BASE}/api/recharge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: state.currentUser.user_id,
                amount: amount,
                paymentMethod: 'SMS'
            })
        });

        const data = await res.json();
        if (data.success) {
            rechargeModal.classList.add('hidden');
            state.currentUser = data.user;
            showReceipt(data.receipt);
            showToast(`Recharge of $${amount.toFixed(2)} Successful!`, 'success');
        } else {
            showToast(data.message || 'Recharge failed', 'error');
        }
    } catch (err) {
        showToast('Network error during recharge', 'error');
    }
}

function populateTransferModal() {
    if (!state.currentUser) return;
    const availLabel = document.getElementById('transferAvailableLabel');
    if (availLabel) {
        availLabel.textContent = `Available: $${state.currentUser.balance.toFixed(2)}`;
    }

    const select = document.getElementById('recipientSelect');
    const phoneInput = document.getElementById('recipientPhoneInput');
    if (select) {
        select.innerHTML = '';
        state.allUsers.forEach(u => {
            if (u.user_id !== state.currentUser.user_id) {
                const opt = document.createElement('option');
                opt.value = u.phone_number;
                opt.textContent = `${u.full_name} - ${u.phone_number}`;
                select.appendChild(opt);
            }
        });

        if (select.options.length > 0) {
            if (phoneInput) phoneInput.value = select.options[0].value;
        }
    }

    updateTransferPreview();
}

function updateTransferPreview() {
    const amountInput = document.getElementById('transferAmountInput');
    const calcRow = document.getElementById('transferCalcRow');
    const getsRow = document.getElementById('transferRecipientGets');

    if (!state.currentUser || !amountInput) return;

    const amount = parseFloat(amountInput.value) || 0;
    const currentBal = state.currentUser.balance;
    const newBal = Math.max(0, currentBal - amount);

    if (calcRow) calcRow.textContent = `$${currentBal.toFixed(2)} → $${newBal.toFixed(2)}`;
    if (getsRow) getsRow.textContent = `+$${amount.toFixed(2)}`;
}

async function executeTransfer() {
    if (!state.currentUser) return;

    const amountInput = document.getElementById('transferAmountInput');
    const phoneInput = document.getElementById('recipientPhoneInput');

    const amount = parseFloat(amountInput ? amountInput.value : 0);
    const recipientPhone = phoneInput ? phoneInput.value.trim() : '';

    if (!amount || amount <= 0) {
        return showToast('Please enter a valid transfer amount', 'error');
    }
    if (!recipientPhone) {
        return showToast('Please select or enter a recipient phone number', 'error');
    }

    try {
        const res = await fetch(`${API_BASE}/api/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderId: state.currentUser.user_id,
                recipientPhone: recipientPhone,
                amount: amount,
                pin: '1234'
            })
        });

        const data = await res.json();
        if (data.success) {
            transferModal.classList.add('hidden');
            state.currentUser = data.user;
            showReceipt(data.receipt);
            showToast(`Transferred $${amount.toFixed(2)} Successfully!`, 'success');
        } else {
            showToast(data.message || 'Transfer failed', 'error');
        }
    } catch (err) {
        showToast('Network error during transfer', 'error');
    }
}

function updateConvertPreview() {
    const slider = document.getElementById('convertSlider');
    const hugeDisplay = document.getElementById('convertHugeDisplay');
    const dollarSide = document.getElementById('convertDollarSide');
    const dataSide = document.getElementById('convertDataSide');

    const val = slider ? parseFloat(slider.value) : 9;
    const mb = val * 100;

    if (hugeDisplay) hugeDisplay.textContent = `$${val.toFixed(2)}`;
    if (dollarSide) dollarSide.textContent = `$${val.toFixed(2)}`;
    if (dataSide) dataSide.textContent = `${mb} MB`;
}

async function executeConversion() {
    if (!state.currentUser) return;
    const slider = document.getElementById('convertSlider');
    const amount = slider ? parseFloat(slider.value) : 9;

    try {
        const res = await fetch(`${API_BASE}/api/convert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: state.currentUser.user_id,
                amount: amount
            })
        });

        const data = await res.json();
        if (data.success) {
            convertModal.classList.add('hidden');
            state.currentUser = data.user;
            showReceipt(data.receipt);
            showToast(`Converted $${amount} to ${amount * 100} MB!`, 'success');
        } else {
            showToast(data.message || 'Conversion failed', 'error');
        }
    } catch (err) {
        showToast('Network error during conversion', 'error');
    }
}

async function loadPackages() {
    const container = document.getElementById('packagesContainer');
    if (!container) return;

    try {
        const res = await fetch(`${API_BASE}/api/packages`);
        const data = await res.json();
        if (data.success) {
            state.packages = data.packages;
            renderPackagesList();
        }
    } catch (err) {
        console.error('Failed to load packages:', err);
    }
}

function renderPackagesList() {
    const container = document.getElementById('packagesContainer');
    if (!container) return;
    container.innerHTML = '';

    state.packages.forEach(pkg => {
        const card = document.createElement('div');
        card.className = 'package-card';
        card.innerHTML = `
            <div class="package-card-top">
                <div class="package-title-row">
                    <svg class="pkg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
                        <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
                        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                        <line x1="12" y1="20" x2="12.01" y2="20"/>
                    </svg>
                    <span class="package-name">${pkg.package_name}</span>
                    ${pkg.is_popular ? '<span class="badge-popular">★ Popular</span>' : ''}
                </div>
                <span class="package-price">$${pkg.price}</span>
            </div>
            <div class="package-specs">${pkg.data_gb}GB • Valid for ${pkg.validity_days} days</div>
            <button class="btn-subscribe" data-id="${pkg.package_id}">Subscribe Now</button>
        `;

        const subBtn = card.querySelector('.btn-subscribe');
        subBtn.addEventListener('click', () => subscribeToPackage(pkg.package_id));
        container.appendChild(card);
    });
}

async function subscribeToPackage(packageId) {
    if (!state.currentUser) return;
    try {
        const res = await fetch(`${API_BASE}/api/packages/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: state.currentUser.user_id,
                packageId: packageId
            })
        });

        const data = await res.json();
        if (data.success) {
            state.currentUser = data.user;
            showReceipt(data.receipt);
            showToast('Package subscription successful!', 'success');
        } else {
            showToast(data.message || 'Subscription failed', 'error');
        }
    } catch (err) {
        showToast('Network error during subscription', 'error');
    }
}

function showReceipt(r) {
    const receiptIdVal = document.getElementById('receiptIdVal');
    const receiptTypeVal = document.getElementById('receiptTypeVal');
    const receiptDateVal = document.getElementById('receiptDateVal');
    const receiptStatusVal = document.getElementById('receiptStatusVal');
    const receiptAmountLabel = document.getElementById('receiptAmountLabel');
    const receiptAmountVal = document.getElementById('receiptAmountVal');
    const receiptFromVal = document.getElementById('receiptFromVal');
    const receiptToVal = document.getElementById('receiptToVal');

    if (receiptIdVal) receiptIdVal.textContent = r.receiptId || 'TXN0571337504';
    if (receiptTypeVal) receiptTypeVal.textContent = r.type || 'Transfer';
    if (receiptDateVal) receiptDateVal.textContent = r.date || 'Feb 8, 2026, 7:22 PM';
    if (receiptStatusVal) receiptStatusVal.textContent = `• ${r.status || 'Success'}`;

    if (receiptAmountLabel) {
        receiptAmountLabel.textContent = r.type === 'Recharge' ? 'Amount Recharged' : 'Amount Transferred';
    }
    if (receiptAmountVal) receiptAmountVal.textContent = `$${parseFloat(r.amount).toFixed(2)}`;

    if (receiptFromVal) receiptFromVal.textContent = r.from || `${state.currentUser.full_name} (${state.currentUser.phone_number})`;
    if (receiptToVal) receiptToVal.textContent = r.to || 'MTC Touch Network';

    receiptModal.classList.remove('hidden');
}

function initActivityListeners() {}

async function loadActivityView() {
    if (!state.currentUser) return;

    const accountDesc = document.getElementById('activityAccountDesc');
    if (accountDesc) {
        accountDesc.textContent = `${state.currentUser.full_name} (${state.currentUser.phone_number})`;
    }

    renderTeamMembersList();
    await renderTransactionsList();
}

function renderTeamMembersList() {
    const list = document.getElementById('teamMembersList');
    if (!list) return;
    list.innerHTML = '';

    state.allUsers.forEach(u => {
        const isCurrent = u.user_id === state.currentUser.user_id;
        const initial = u.full_name.charAt(0).toUpperCase();

        const item = document.createElement('div');
        item.className = `team-card ${isCurrent ? 'is-active-user' : ''}`;
        item.innerHTML = `
            <div class="team-card-left">
                <div class="team-avatar">${initial}</div>
                <div>
                    <span class="team-name">${u.full_name}</span>
                    <span class="team-phone">${u.phone_number}</span>
                </div>
            </div>
            ${isCurrent ? '<span class="badge-you">You</span>' : ''}
        `;

        item.addEventListener('click', () => {
            if (!isCurrent) {
                const confirmSwitch = confirm(`Switch view to ${u.full_name}?`);
                if (confirmSwitch) {
                    selectUser(u.user_id);
                    updateHomeView();
                    loadActivityView();
                }
            }
        });

        list.appendChild(item);
    });
}

async function renderTransactionsList() {
    const list = document.getElementById('transactionsList');
    if (!list || !state.currentUser) return;
    list.innerHTML = '';

    try {
        const res = await fetch(`${API_BASE}/api/transactions/${state.currentUser.user_id}`);
        const data = await res.json();
        if (data.success && data.transactions) {
            if (data.transactions.length === 0) {
                list.innerHTML = '<div style="color:#64748b; font-size:13px; text-align:center; padding:20px;">No transactions yet</div>';
                return;
            }

            data.transactions.forEach(tx => {
                const isPlus = tx.transaction_type === 'recharge' || tx.transaction_type === 'transfer_received';
                const sign = isPlus ? '+' : '-';
                const colorClass = isPlus ? 'tx-plus' : 'tx-minus';
                const iconClass = isPlus ? 'tx-icon-green' : (tx.transaction_type === 'dollar_to_data' ? 'tx-icon-purple' : 'tx-icon-blue');

                let title = tx.details || tx.transaction_type;
                if (tx.transaction_type === 'recharge') title = 'Recharge';

                const card = document.createElement('div');
                card.className = 'transaction-card';
                card.innerHTML = `
                    <div class="tx-left">
                        <div class="tx-icon-circle ${iconClass}">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                ${isPlus ? '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' : '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>'}
                            </svg>
                        </div>
                        <div>
                            <span class="tx-title">${title}</span>
                            <span class="tx-date">${formatTxDate(tx.transaction_timestamp)}</span>
                        </div>
                    </div>
                    <span class="tx-amount ${colorClass}">${sign}${parseFloat(tx.amount).toFixed(2)}$</span>
                `;

                card.addEventListener('click', () => {
                    showReceipt({
                        receiptId: tx.receipt_id,
                        type: tx.transaction_type.toUpperCase(),
                        date: formatTxDate(tx.transaction_timestamp),
                        status: 'Success',
                        amount: tx.amount,
                        from: tx.sender_name ? `${tx.sender_name} (${tx.sender_phone})` : `${state.currentUser.full_name}`,
                        to: tx.recipient_name ? `${tx.recipient_name} (${tx.recipient_phone})` : 'MTC Touch Network'
                    });
                });

                list.appendChild(card);
            });
        }
    } catch (err) {
        console.error('Error loading transactions:', err);
    }
}

function formatTxDate(rawDate) {
    if (!rawDate) return 'Just now';
    try {
        const d = new Date(rawDate);
        return d.toLocaleString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: true
        });
    } catch (e) {
        return rawDate;
    }
}

// =====================================================
// SETTINGS SCREEN
// =====================================================
function initSettingsListeners() {
    const toggle2FA = document.getElementById('setting2FAToggle');
    const autoLockSlider = document.getElementById('autoLockSlider');
    const autoLockBadge = document.getElementById('autoLockValueBadge');
    const dailyLimitSlider = document.getElementById('dailyLimitSlider');
    const dailyLimitBadge = document.getElementById('dailyLimitValueBadge');
    const togglePinVerify = document.getElementById('settingPinVerifyToggle');

    if (toggle2FA) {
        toggle2FA.addEventListener('change', () => {
            saveUserSettings({ isTwoFactor: toggle2FA.checked });
        });
    }

    if (autoLockSlider && autoLockBadge) {
        autoLockSlider.addEventListener('input', () => {
            const val = parseInt(autoLockSlider.value, 10);
            autoLockBadge.textContent = `${val}s`;
        });
        autoLockSlider.addEventListener('change', () => {
            saveUserSettings({ autoLockTimer: parseInt(autoLockSlider.value, 10) });
        });
    }

    if (dailyLimitSlider && dailyLimitBadge) {
        dailyLimitSlider.addEventListener('input', () => {
            const val = parseFloat(dailyLimitSlider.value);
            dailyLimitBadge.textContent = `$${val}`;
        });
        dailyLimitSlider.addEventListener('change', () => {
            saveUserSettings({ dailyLimit: parseFloat(dailyLimitSlider.value) });
        });
    }

    if (togglePinVerify) {
        togglePinVerify.addEventListener('change', () => {
            saveUserSettings({ requirePin: togglePinVerify.checked });
        });
    }
}

function loadSettingsView() {
    if (!state.currentUser) return;
    const u = state.currentUser;

    const toggle2FA = document.getElementById('setting2FAToggle');
    const autoLockSlider = document.getElementById('autoLockSlider');
    const autoLockBadge = document.getElementById('autoLockValueBadge');
    const dailyLimitSlider = document.getElementById('dailyLimitSlider');
    const dailyLimitBadge = document.getElementById('dailyLimitValueBadge');
    const togglePinVerify = document.getElementById('settingPinVerifyToggle');

    if (toggle2FA) toggle2FA.checked = Boolean(u.is_two_factor_enabled);
    if (autoLockSlider) autoLockSlider.value = u.auto_lock_timer || 60;
    if (autoLockBadge) autoLockBadge.textContent = `${u.auto_lock_timer || 60}s`;
    if (dailyLimitSlider) dailyLimitSlider.value = u.daily_transfer_limit || 50;
    if (dailyLimitBadge) dailyLimitBadge.textContent = `$${u.daily_transfer_limit || 50}`;
    if (togglePinVerify) togglePinVerify.checked = Boolean(u.require_transfer_pin ?? 1);
}

async function saveUserSettings(updatedFields) {
    if (!state.currentUser) return;
    try {
        const res = await fetch(`${API_BASE}/api/user/${state.currentUser.user_id}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedFields)
        });

        const data = await res.json();
        if (data.success) {
            state.currentUser = data.user;
            showToast('Settings Saved', 'success');
        }
    } catch (err) {
        showToast('Failed to update settings', 'error');
    }
}

// =====================================================
// SECURITY & ALERTS MODALS
// =====================================================
async function openSecurityModal() {
    if (!state.currentUser) return;
    try {
        const res = await fetch(`${API_BASE}/api/security/${state.currentUser.user_id}`);
        const data = await res.json();
        if (data.success) {
            const secEncVal = document.getElementById('secEncryptionVal');
            if (secEncVal) secEncVal.textContent = data.info.encryption.key_algorithm || 'AES-256';

            const logsList = document.getElementById('secLogsList');
            if (logsList) {
                logsList.innerHTML = '';
                if (data.logs.length === 0) {
                    logsList.innerHTML = '<div style="color:#64748b; font-size:12px;">No security logs recorded</div>';
                } else {
                    data.logs.forEach(log => {
                        const item = document.createElement('div');
                        item.className = 'sec-log-item';
                        item.innerHTML = `
                            <span class="sec-log-type">${log.event_type.toUpperCase()} (Risk: ${log.risk_score})</span>
                            <span>${log.event_details || ''}</span>
                            <span class="sec-log-time">${log.event_timestamp} • IP: ${log.ip_address}</span>
                        `;
                        logsList.appendChild(item);
                    });
                }
            }

            securityModal.classList.remove('hidden');
        }
    } catch (err) {
        showToast('Error fetching security info', 'error');
    }
}

async function openAlertsModal() {
    if (!state.currentUser) return;
    try {
        const res = await fetch(`${API_BASE}/api/alerts/${state.currentUser.user_id}`);
        const data = await res.json();
        if (data.success) {
            const list = document.getElementById('alertsListContainer');
            if (list) {
                list.innerHTML = '';
                if (data.alerts.length === 0) {
                    list.innerHTML = '<div style="color:#64748b; font-size:12px; text-align:center; padding:10px;">No alerts</div>';
                } else {
                    data.alerts.forEach(a => {
                        const card = document.createElement('div');
                        card.className = `alert-card ${a.severity}`;
                        card.innerHTML = `
                            <span style="font-weight:700; color:#fff;">${a.alert_type.toUpperCase()}</span>
                            <span>${a.alert_message}</span>
                            <span style="font-size:10px; color:#94a3b8;">${a.created_at}</span>
                        `;
                        list.appendChild(card);
                    });
                }
            }

            alertsModal.classList.remove('hidden');
            if (bellBadgeDot) bellBadgeDot.classList.remove('show');
        }
    } catch (err) {
        showToast('Error loading alerts', 'error');
    }
}

// =====================================================
// INACTIVITY / AUTO-LOCK
// =====================================================
function initIdleDetection() {
    const reset = () => resetInactivity();
    window.addEventListener('mousemove', reset);
    window.addEventListener('keydown', reset);
    window.addEventListener('touchstart', reset);
    window.addEventListener('click', reset);

    setInterval(() => {
        if (state.currentScreen === 'authScreen') return;
        state.inactivitySeconds += 1;
        const lockLimit = (state.currentUser && state.currentUser.auto_lock_timer) || 60;
        if (state.inactivitySeconds >= lockLimit) {
            lockApp();
        }
    }, 1000);
}

function resetInactivity() {
    state.inactivitySeconds = 0;
}

// =====================================================
// TOAST NOTIFICATIONS
// =====================================================
function showToast(message, type = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}
