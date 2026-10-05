/**
 * Karuwaki Authentication & Password Security Interactions
 * Real-time password strength meter, requirements checklist,
 * password matching validator, and show/hide password toggle.
 */

document.addEventListener('DOMContentLoaded', function() {
    const oldPass = document.getElementById('id_old_password');
    const newPass1 = document.getElementById('id_new_password1');
    const newPass2 = document.getElementById('id_new_password2');
    const submitBtn = document.getElementById('btnSubmitPassword');

    // Strength elements
    const bar1 = document.getElementById('bar-1');
    const bar2 = document.getElementById('bar-2');
    const bar3 = document.getElementById('bar-3');
    const bar4 = document.getElementById('bar-4');
    const strengthBadge = document.getElementById('strength-badge');

    // Checklist elements
    const reqLength = document.getElementById('req-length');
    const reqNumber = document.getElementById('req-number');
    const reqUpper = document.getElementById('req-upper');
    const reqSpecial = document.getElementById('req-special');
    const reqDifferent = document.getElementById('req-different');

    // Match badge
    const matchBadge = document.getElementById('match-badge');

    // 1. Password Visibility Toggle
    document.querySelectorAll('.btn-toggle-eye').forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const targetInput = document.getElementById(targetId);
            const icon = this.querySelector('i');

            if (targetInput) {
                if (targetInput.type === 'password') {
                    targetInput.type = 'text';
                    icon.className = 'bi bi-eye-slash';
                } else {
                    targetInput.type = 'password';
                    icon.className = 'bi bi-eye';
                }
            }
        });
    });

    // 2. Real-Time Validation Function
    function validatePasswords() {
        const valOld = oldPass ? oldPass.value : '';
        const val1 = newPass1 ? newPass1.value : '';
        const val2 = newPass2 ? newPass2.value : '';

        // Requirement Checks
        const isLen = val1.length >= 8;
        const isNum = /\d/.test(val1);
        const isUp = /[A-Z]/.test(val1);
        const isSpec = /[^A-Za-z0-9]/.test(val1);
        const isDiff = val1.length > 0 && valOld.length > 0 ? (val1 !== valOld) : true;

        updateCheckItem(reqLength, isLen);
        updateCheckItem(reqNumber, isNum);
        updateCheckItem(reqUpper, isUp);
        updateCheckItem(reqSpecial, isSpec);
        updateCheckItem(reqDifferent, isDiff && val1.length > 0);

        // Strength Calculation (0 to 4)
        let score = 0;
        if (isLen) score++;
        if (isNum) score++;
        if (isUp) score++;
        if (isSpec) score++;

        // Reset bars
        bar1.style.backgroundColor = 'rgba(255,255,255,0.1)';
        bar2.style.backgroundColor = 'rgba(255,255,255,0.1)';
        bar3.style.backgroundColor = 'rgba(255,255,255,0.1)';
        bar4.style.backgroundColor = 'rgba(255,255,255,0.1)';

        if (val1.length === 0) {
            strengthBadge.textContent = 'ENTER PASSWORD';
            strengthBadge.style.color = 'rgba(255,255,255,0.4)';
        } else if (score === 1) {
            bar1.style.backgroundColor = '#ff4d4d';
            strengthBadge.textContent = 'WEAK';
            strengthBadge.style.color = '#ff4d4d';
        } else if (score === 2) {
            bar1.style.backgroundColor = '#ffa64d';
            bar2.style.backgroundColor = '#ffa64d';
            strengthBadge.textContent = 'FAIR';
            strengthBadge.style.color = '#ffa64d';
        } else if (score === 3) {
            bar1.style.backgroundColor = '#ffff4d';
            bar2.style.backgroundColor = '#ffff4d';
            bar3.style.backgroundColor = '#ffff4d';
            strengthBadge.textContent = 'STRONG';
            strengthBadge.style.color = '#ffff4d';
        } else if (score === 4) {
            bar1.style.backgroundColor = '#C1FF72';
            bar2.style.backgroundColor = '#C1FF72';
            bar3.style.backgroundColor = '#C1FF72';
            bar4.style.backgroundColor = '#C1FF72';
            strengthBadge.textContent = 'EXCELLENT';
            strengthBadge.style.color = '#C1FF72';
        }

        // Match Check
        let isMatch = false;
        if (val2.length === 0) {
            matchBadge.className = 'match-status-badge neutral';
            matchBadge.innerHTML = '<i class="bi bi-circle"></i> AWAITING MATCH';
            newPass2.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        } else if (val1 === val2 && val1.length > 0) {
            matchBadge.className = 'match-status-badge matched';
            matchBadge.innerHTML = '<i class="bi bi-check-circle-fill"></i> PASSWORDS MATCH';
            newPass2.style.borderColor = 'var(--accent-green)';
            isMatch = true;
        } else {
            matchBadge.className = 'match-status-badge mismatch';
            matchBadge.innerHTML = '<i class="bi bi-x-circle-fill"></i> DO NOT MATCH';
            newPass2.style.borderColor = '#ff4d4d';
            isMatch = false;
        }

        // Submit Button State
        const allRequirementsMet = isLen && isNum && isUp && isSpec && isDiff && isMatch && (valOld.length > 0);
        submitBtn.disabled = !allRequirementsMet;
    }

    function updateCheckItem(element, isValid) {
        if (!element) return;
        const icon = element.querySelector('i');
        if (isValid) {
            element.classList.add('valid');
            if (icon) icon.className = 'bi bi-check-circle-fill text-success';
        } else {
            element.classList.remove('valid');
            if (icon) icon.className = 'bi bi-circle';
        }
    }

    if (newPass1) newPass1.addEventListener('input', validatePasswords);
    if (newPass2) newPass2.addEventListener('input', validatePasswords);
    if (oldPass) oldPass.addEventListener('input', validatePasswords);

    // Initial check run
    validatePasswords();
});
