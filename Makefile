MAIN_JS_FILE := "src/index.js"

all:
	npx prettier --single-quote false --html-whitespace-sensitivity strict --no-bracket-spacing --quote-props preserve --trailing-comma none --print-width 100 --write --tab-width 4 src/*.js
	reset
	node ${MAIN_JS_FILE}