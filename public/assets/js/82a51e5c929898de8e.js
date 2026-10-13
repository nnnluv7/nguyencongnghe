
//<![CDATA[
/* MODULE 2: LAYOUT REGISTRY */
window.QuizLayouts = {
    options: ['layout-list', 'layout-grid', 'layout-pills', 'layout-cards'],
    getRandom: function() { return this.options[Math.floor(Math.random() * this.options.length)]; }
};
//]]>
