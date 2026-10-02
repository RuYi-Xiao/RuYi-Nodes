if (!document.getElementById('ruyi-node-theme')) {
    const style = document.createElement('style');
    style.id = 'ruyi-node-theme';
    style.textContent = `:root {
        --ruyi-node-bg: #333333;
        --ruyi-group-bg: #292929;
        --ruyi-content-bg: #222222;
        --ruyi-control-bg: #3a3a3a;
        --ruyi-border: #505050;
        --ruyi-hover-bg: #474747;
        --ruyi-text: #eeeeee;
        --ruyi-muted: #aaaaaa;
    }`;
    document.head.append(style);
}
