// 玩家账号安全：自助修改登录密码
// 独立实现，仅依赖已在全局声明的 invokeDungeonAction / showToast。
// 后端动作：changePassword（校验当前密码 -> 仅更新 password_hash / password_salt）
(function () {
    function toast(message) {
        try {
            if (typeof showToast === 'function') { showToast(message); return; }
        } catch (_) {}
        try { window.alert(message); } catch (_) {}
    }

    function $(id) {
        return document.getElementById(id);
    }

    async function submitChangePassword() {
        const oldEl = $('changePasswordOld');
        const newEl = $('changePasswordNew');
        const confirmEl = $('changePasswordConfirm');
        const oldPassword = oldEl ? oldEl.value : '';
        const newPassword = newEl ? newEl.value : '';
        const confirmPassword = confirmEl ? confirmEl.value : '';

        if (!oldPassword) { toast('请输入当前密码'); return; }
        if (newPassword.length < 6 || newPassword.length > 72) { toast('新密码需 6-72 位'); return; }
        if (newPassword !== confirmPassword) { toast('两次输入的新密码不一致'); return; }
        if (oldPassword === newPassword) { toast('新密码不能与当前密码相同'); return; }

        try {
            if (typeof invokeDungeonAction !== 'function') { toast('页面尚未就绪，请稍后重试'); return; }
            const { error } = await invokeDungeonAction('changePassword', { oldPassword, newPassword });
            if (error) { toast('修改失败：' + (error.message || '未知错误')); return; }
            if (oldEl) oldEl.value = '';
            if (newEl) newEl.value = '';
            if (confirmEl) confirmEl.value = '';
            toast('密码已修改，请牢记新密码');
        } catch (error) {
            toast('修改失败：' + (error && error.message ? error.message : (error || '未知错误')));
        }
    }

    window.submitChangePassword = submitChangePassword;
})();
