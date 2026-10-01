export function renderDifferentiabilityNote(container) {
    const content = `
        <article class="math-tex">
            <h2>全微分可能性の補足</h2>
            <p class="author-date">藤原和将 (2021年11月10日)</p>

            <section>
                <p>$D \\subset \\mathbb{R}^2$ ($(0,0)\\in D)$を開集合とする．$f: D \\to \\mathbb{R}$が原点に於いて全微分可能であるとは，$f$が２つの定数$A, B$を伴って，</p>
                <div class="math-display">
                    \\[ f(x,y) = Ax + By + o(|(x,y)|) \\]
                </div>
                <p>を満たす事である．このノートでは，原点に於ける全微分可能性の判定方法に就いて見る．</p>
            </section>

            <section>
                <p>$f$が原点で全微分可能である事を判定する方法として，次がよく用いられる．</p>

                <div class="proposition">
                    <h3>命題（Proposition）</h3>
                    <p>$f \\in C^1(D)$ならば$f$は原点で全微分可能である．特に，</p>
                    <div class="math-display">
                        \\[ A = \\partial_x f(0,0),\\quad B = \\partial_y f(0,0) \\]
                    </div>
                    <p>である．</p>
                </div>

                <p>一方で，$f$の極座標表示が特定の形をしているならば，原点での全微分可能性の判定は容易である．</p>

                <div class="proposition">
                    <h3>命題（Proposition）</h3>
                    <p>$\\varphi: [-\\pi,\\pi] \\to \\mathbb{R}$が$\\varphi(-\\pi)=\\varphi(\\pi)$を満たすとする．$f : \\mathbb{R}^2 \\to \\mathbb{R}$を</p>
                    <div class="math-display">
                        \\[ f(r \\cos \\theta, r \\sin \\theta) = r \\varphi (\\theta) \\]
                    </div>
                    <p>で与える．この時，$f$が原点に於いて全微分可能である事と</p>
                    <div class="math-display">
                        \\[ f(x,y) = A x + B y \\]
                    </div>
                    <p>なる実数$A,B$が存在する事は同値である．</p>
                </div>
            </section>

            <section>
                <div class="remark">
                    <h3>補足（Remark）</h3>
                    <p>上の命題を言い換えれば，$f$が原点に於いて全微分可能である事と，$\\varphi(\\theta) = A \\cos \\theta + B \\sin \\theta$である事が同値である．また，$f$が原点に於いて全微分可能である事と，$f$のグラフが原点を含む平面となることが同値である．特に，原点で全微分可能であるならば，$f$は$\\mathbb{R}^2$上至る所全微分可能である．</p>
                </div>

                <div class="proof">
                    <h3>証明（Proof）</h3>
                    <p>$f(x,y) = Ax + By$ならば，全微分可能性の定義より$f$は全微分可能である．$f$が全微分可能であるならば，２つの実数$A,B$が存在して，</p>
                    <div class="math-display">
                        \\[ f(r \\cos \\theta, r \\sin \\theta) - f(0,0) = ( A \\cos \\theta + B \\sin \\theta ) r + o(r) \\]
                    </div>
                    <p>である．$f(0,0)=0$なので，</p>
                    <div class="math-display">
                        \\[ \\varphi(\\theta) = \\lim_{r \\searrow 0} \\frac{f(r \\cos \\theta, r \\sin \\theta)-f(0,0)}{r} = A \\cos \\theta + B \\sin \\theta \\]
                    </div>
                    <p>であるから，$o(r)=0$である．従って，$f(x,y)=Ax+By$を得る．</p>
                </div>
            </section>

            <section>
                <div class="remark">
                    <h3>補足（Remark）</h3>
                    <p>上記命題より，例えば，</p>
                    <div class="math-display">
                        \\[ b(x,y) = \\begin{cases} \\frac{x^3+y^3}{x^2+y^2} & \\mathrm{if} (x,y) \\neq 0, \\\\ 0 & \\mathrm{if} (x,y) = 0 \\end{cases} \\]
                    </div>
                    <p>は原点に於いて連続且つ偏微分可能であるが，全微分不能である．実際</p>
                    <div class="math-display">
                        \\[ b(r \\cos \\theta, r \\sin \\theta) = r ( \\cos^3 \\theta + \\sin^3 \\theta) \\]
                    </div>
                    <p>である．$b(x,y)$は一次式ではないので，$b$は原点に於いて全微分不能である．偏導関数が原点で不連続になっている事は，最初の命題の対偶命題から従う．</p>
                </div>

                <div class="remark">
                    <h3>補足（Remark）</h3>
                    <p>$F$を$f$の極座標表示とすれば，</p>
                    <div class="math-display">
                        \\[ \\frac{\\partial}{\\partial x} f(0,0) = \\frac{\\partial}{\\partial r} F(0,0) = \\varphi(0),\\quad \\frac{\\partial}{\\partial y} f(0,0) = \\frac{\\partial}{\\partial r} F(0,\\pi/2) = \\varphi(\\pi/2) \\]
                    </div>
                    <p>である．</p>
                </div>

                <div class="remark">
                    <h3>補足（Remark）</h3>
                    <p>上記命題で$\\varphi$が微分可能な場合に於いて，$f$の偏導関数の挙動を見てみよう．$F$を$f$の極座標表示とすれば，$(x,y) \\neq (0,0)$に於いて</p>
                    <div class="math-display">
                        \\[ \\frac{\\partial}{\\partial x} f(x,y) = \\cos \\theta \\frac{\\partial}{\\partial r} F(r,\\theta) - \\frac{\\sin \\theta}{r} \\frac{\\partial}{\\partial \\theta} F(r,\\theta) = \\varphi(\\theta) \\cos \\theta - \\varphi'(\\theta) \\sin \\theta, \\]
                    </div>
                    <div class="math-display">
                        \\[ \\frac{\\partial}{\\partial y} f(x,y) = \\sin \\theta \\frac{\\partial}{\\partial r} F(r,\\theta) + \\frac{\\cos \\theta}{r} \\frac{\\partial}{\\partial \\theta} F(r,\\theta) = \\varphi(\\theta) \\sin \\theta + \\varphi'(\\theta) \\cos \\theta \\]
                    </div>
                    <p>である．もし，上記２つの偏導関数が原点に於いて連続であるならば，２つの偏導関数は$\\theta$に依存しない．即ち，</p>
                    <div class="math-display">
                        \\[ \\varphi(\\theta) \\cos \\theta - \\varphi'(\\theta) \\sin \\theta = A,\\quad \\varphi(\\theta) \\sin \\theta + \\varphi'(\\theta) \\cos \\theta = B \\]
                    </div>
                    <p>なる定数$A,B$が存在する．</p>
                    <div class="math-display">
                        \\[ \\varphi(\\theta) = \\cos \\theta \\{ \\varphi(\\theta) \\cos \\theta - \\varphi'(\\theta) \\sin \\theta \\} + \\sin \\theta \\{ \\varphi(\\theta) \\sin \\theta + \\varphi'(\\theta) \\cos \\theta \\} = A \\cos \\theta + B \\sin \\theta \\]
                    </div>
                    <p>より，最初の命題と極座標命題の関係が分かる．</p>
                </div>
            </section>

            <section class="references">
                <h3>参考文献</h3>
                <p>鈴木 武, 柴田 良弘, 田中 和永 , 山田 義雄 著,<br>
                理工系のための微分積分I, 2007/4/1 内田老鶴圃出版 (ISBN: 4753601811)</p>
            </section>
        </article>
    `;

    requestAnimationFrame(() => {
        container.innerHTML = content;

        // MathJaxのロード完了を待ってからtypeset
        function rerender() {
            if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise([container]).catch(err => {
                    console.error('MathJax typesetting failed: ' + err.message);
                });
            } else {
                setTimeout(rerender, 100);
            }
        }
        rerender();
    });
} 