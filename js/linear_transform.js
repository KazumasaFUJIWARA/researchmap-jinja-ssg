// キャンバスの設定
const originalCanvas = document.getElementById('originalCanvas');
const transformedCanvas = document.getElementById('transformedCanvas');
const originalCtx = originalCanvas.getContext('2d');
const transformedCtx = transformedCanvas.getContext('2d');

// 画像の読み込み
const img = new Image();
img.src = 'ryukoku_logo.png';

// 行列の入力要素
const a11 = document.getElementById('a11');
const a12 = document.getElementById('a12');
const a21 = document.getElementById('a21');
const a22 = document.getElementById('a22');

// スケール要素
const scaleInput = document.getElementById('scale');
const scaleValue = document.getElementById('scaleValue');
const rankValue = document.getElementById('rankValue');

// 固有値と固有ベクトルを計算する関数
function calculateEigenvalues(matrix) {
    const a = 1;
    const b = -(matrix[0][0] + matrix[1][1]);
    const c = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
    
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;
    
    const lambda1 = (-b + Math.sqrt(discriminant)) / (2 * a);
    const lambda2 = (-b - Math.sqrt(discriminant)) / (2 * a);
    
    return [lambda1, lambda2];
}

// ベクトルを正規化する関数
function normalizeVector(vector) {
    const length = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1]);
    return [vector[0] / length, vector[1] / length];
}

// 行列の階数を計算する関数
function calculateRank(matrix) {
    const EPSILON = 1e-10;
    const a = matrix[0][0], b = matrix[0][1];
    const c = matrix[1][0], d = matrix[1][1];

    const det = a * d - b * c;
    if (Math.abs(det) > EPSILON) return 2;

    if (Math.abs(a) > EPSILON || Math.abs(b) > EPSILON ||
        Math.abs(c) > EPSILON || Math.abs(d) > EPSILON) {
        return 1;
    }

    return 0;
}

// 固有ベクトルを計算する関数
function calculateEigenvectors(matrix, eigenvalue) {
    const EPSILON = 1e-10;

    // (A - λI) の作成
    const subtracted = [
        [matrix[0][0] - eigenvalue, matrix[0][1]],
        [matrix[1][0], matrix[1][1] - eigenvalue]
    ];

    // ランクを調べる
    const rank = calculateRank(subtracted);

    // ランク0 → 全てのベクトルが固有ベクトル（基底を返す）
    if (rank === 0) {
        return [
            normalizeVector([1, 0]),
            normalizeVector([0, 1])
        ];
    }

    // ランク1 → 一次元の固有空間（1本だけ返す）
    let vector = null;
    const a = subtracted[0][0];
    const b = subtracted[0][1];
    const c = subtracted[1][0];
    const d = subtracted[1][1];

    if (Math.abs(b) > EPSILON) {
        vector = [1, -a / b];
    } else if (Math.abs(c) > EPSILON) {
        vector = [-d / c, 1];
    } else if (Math.abs(a) > EPSILON || Math.abs(d) > EPSILON) {
        vector = [0, 1];
    } else {
        vector = [1, 0];
    }

    return [normalizeVector(vector)];

    // ランク2は理論的に起きない（零ベクトル以外の解がないため）
}

// 座標系を描画する関数
function drawCoordinateSystem(ctx, scale = 1) {
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    
    // 座標軸
    ctx.beginPath();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    
    // X軸
    ctx.moveTo(0, centerY);
    ctx.lineTo(ctx.canvas.width, centerY);
    
    // Y軸
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, ctx.canvas.height);
    
    // 目盛り
    const tickSize = 20;
    for (let i = -10; i <= 10; i++) {
        // X軸の目盛り
        ctx.moveTo(centerX + i * tickSize, centerY - 5);
        ctx.lineTo(centerX + i * tickSize, centerY + 5);
        
        // Y軸の目盛り
        ctx.moveTo(centerX - 5, centerY + i * tickSize);
        ctx.lineTo(centerX + 5, centerY + i * tickSize);
    }
    
    ctx.stroke();
}

// ベクトルを描画する関数
function drawVector(ctx, vector, color, scale = 1, isEigenvector = false) {
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    const baseLength = 112.5;
    const currentScale = parseFloat(scaleInput.value);
    const length = baseLength * currentScale;
    
    // ベクトルの長さが0に近い場合は描画しない
    if (Math.abs(vector[0]) < 1e-10 && Math.abs(vector[1]) < 1e-10) {
        return;
    }
    
    // グラデーションの作成
    const gradient = ctx.createLinearGradient(
        centerX, centerY,
        centerX + vector[0] * length,
        centerY - vector[1] * length
    );
    
    if (isEigenvector) {
        // 固有ベクトルの場合：赤または青の単色
        if (color === 'red') {
            gradient.addColorStop(0, 'rgba(255, 0, 0, 0.7)');
            gradient.addColorStop(1, 'rgba(255, 0, 0, 1)');
        } else {
            gradient.addColorStop(0, 'rgba(0, 0, 255, 0.7)');
            gradient.addColorStop(1, 'rgba(0, 0, 255, 1)');
        }
    } else {
        // 通常のベクトルの場合：グレー
        if (color === 'green') {
            gradient.addColorStop(0, 'rgba(100, 100, 100, 0.7)');
            gradient.addColorStop(1, 'rgba(100, 100, 100, 1)');
        } else {
            gradient.addColorStop(0, 'rgba(150, 150, 150, 0.7)');
            gradient.addColorStop(1, 'rgba(150, 150, 150, 1)');
        }
    }
    
    // 矢印の描画
    ctx.beginPath();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = isEigenvector ? 5 : 4;
    
    // 線の描画
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
        centerX + vector[0] * length,
        centerY - vector[1] * length
    );
    ctx.stroke();
    
    // 三角形の矢印を描画
    const arrowSize = 15 * currentScale;
    const angle = Math.atan2(-vector[1], vector[0]);
    const tipX = centerX + vector[0] * length;
    const tipY = centerY - vector[1] * length;
    
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
        tipX - arrowSize * Math.cos(angle - Math.PI/6),
        tipY - arrowSize * Math.sin(angle - Math.PI/6)
    );
    ctx.lineTo(
        tipX - arrowSize * Math.cos(angle + Math.PI/6),
        tipY - arrowSize * Math.sin(angle + Math.PI/6)
    );
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // ベクトルの始点に円を描画
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3 * currentScale, 0, Math.PI * 2);
    ctx.fillStyle = isEigenvector 
        ? (color === 'red' ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 0, 255, 0.8)')
        : (color === 'green' ? 'rgba(100, 100, 100, 0.8)' : 'rgba(150, 150, 150, 0.8)');
    ctx.fill();
}

// 画像を描画する関数
function drawImage(ctx, matrix = null) {
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    const scale = parseFloat(scaleInput.value);
    
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    drawCoordinateSystem(ctx);
    
    if (matrix) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.transform(
            matrix[0][0], matrix[1][0],
            matrix[0][1], matrix[1][1],
            0, 0
        );
        ctx.drawImage(img, -img.width/2 * scale, -img.height/2 * scale, 
                     img.width * scale, img.height * scale);
        ctx.restore();
    } else {
        ctx.drawImage(img, 
                     centerX - img.width/2 * scale, 
                     centerY - img.height/2 * scale,
                     img.width * scale, 
                     img.height * scale);
    }
}

// 更新関数
function update() {
    const matrix = [
        [parseFloat(a11.value), parseFloat(a12.value)],
        [parseFloat(a21.value), parseFloat(a22.value)]
    ];
    
    // 階数を計算して表示
    const rank = calculateRank(matrix);
    rankValue.textContent = rank;
    
    // 元の画像を描画
    drawImage(originalCtx);
    
    // 変換後の画像を描画
    drawImage(transformedCtx, matrix);
    
    // 基準ベクトルを描画
    drawVector(originalCtx, [1, 0], 'green');
    drawVector(originalCtx, [0, 1], 'blue');
    
    // 変換後の基準ベクトルを描画
    const transformedVector1 = [
        matrix[0][0] * 1 + matrix[0][1] * 0,
        matrix[1][0] * 1 + matrix[1][1] * 0
    ];
    const transformedVector2 = [
        matrix[0][0] * 0 + matrix[0][1] * 1,
        matrix[1][0] * 0 + matrix[1][1] * 1
    ];
    drawVector(transformedCtx, transformedVector1, 'green');
    drawVector(transformedCtx, transformedVector2, 'blue');
    
    // 固有値と固有ベクトルを計算
    const eigenvalues = calculateEigenvalues(matrix);
    let eigenvectorCount = 0;
    if (eigenvalues) {
        const eigenvectors1 = calculateEigenvectors(matrix, eigenvalues[0]);
        eigenvectorCount = eigenvectors1.length;
        
        // 固有ベクトルを描画
        drawVector(originalCtx, eigenvectors1[0], 'red', 1, true);
        drawVector(
            transformedCtx,
            [
                matrix[0][0] * eigenvectors1[0][0] + matrix[0][1] * eigenvectors1[0][1],
                matrix[1][0] * eigenvectors1[0][0] + matrix[1][1] * eigenvectors1[0][1]
            ],
            'red',
            1,
            true
        );

        if (eigenvectors1.length > 1) {
            drawVector(originalCtx, eigenvectors1[1], 'blue', 1, true);
            drawVector(
                transformedCtx,
                [
                    matrix[0][0] * eigenvectors1[1][0] + matrix[0][1] * eigenvectors1[1][1],
                    matrix[1][0] * eigenvectors1[1][0] + matrix[1][1] * eigenvectors1[1][1]
                ],
                'blue',
                1,
                true
            );
        }
    }
    
    // 固有ベクトルの数を表示
    document.getElementById('eigenvectorCount').textContent = eigenvectorCount;
}

// 画像の読み込み完了時の処理
img.onload = () => {
    update();
};

// 入力値が変更された時の処理
[a11, a12, a21, a22].forEach(input => {
    input.addEventListener('input', update);
});

// スケール値が変更された時の処理
scaleInput.addEventListener('input', () => {
    scaleValue.textContent = scaleInput.value;
    update();
}); 