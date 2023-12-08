
/* IMPORT */
/** @jsx createElement */
/** @jsxFragmentFactory Fragment */
import { createElement, Text, createApp, If, ForEach as List } from "./runtime-r1";

let idCounter = 1;
const adjectives = ["pretty", "large", "big", "small", "tall", "short", "long", "handsome", "plain", "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful", "mushy", "odd", "unsightly", "adorable", "important", "inexpensive", "cheap", "expensive", "fancy"],
    colours = ["red", "yellow", "blue", "green", "pink", "brown", "purple", "brown", "white", "black", "orange"],
    nouns = ["table", "chair", "house", "bbq", "desk", "car", "pony", "cookie", "sandwich", "burger", "pizza", "mouse", "keyboard"];

function _random(max) { return Math.round(Math.random() * 1000) % max; };

function buildData(count) {
    let data = new Array(count);
    for (let i = 0; i < count; i++) {
        data[i] = {
            id: idCounter++,
            label: `${adjectives[_random(adjectives.length)]} ${colours[_random(colours.length)]} ${nouns[_random(nouns.length)]}`
        }
    }
    return data;
}

function Button({ id, text, fn }) {
    return <div class='col-sm-6 smallpad'>
        <button id={id}
            class='btn btn-primary btn-block'
            type='button'
            on:click={x => {
                fn();
            }}>{text}</button>
    </div>
}

function App() {
    let data = [];
    let selected = -1;
    const run = () => {
        data = buildData(1000);
    }, runLots = () => {
        data = buildData(10000);
    }, add = () => {
        data = [...data, ...buildData(1000)]
    }, update = () => {
        for (let i = 0, len = data.length; i < len; i += 10) {
            data[i].label = data[i].label + ' !!!';
        }
    }, swapRows = () => {
        const d = data.slice();
        if (d.length > 998) {
            d[1] = data[998];
            d[998] = data[1];
            data = d;
        }
    }, clear = () => {
        data = [];
    }, remove = id => {
        const idx = data.findIndex(d => d.id === id);
        data = [...data.slice(0, idx), ...data.slice(idx + 1)];
    }, isSelected = (id) => id === selected;

    return <div class='container'>
        <div class='jumbotron'><div class='row'>
            <div class='col-md-6'><h1>Test-f Keyed</h1></div>
            <div class='col-md-6'><div class='row'>
                <Button id='run' text='Create 1,000 rows' fn={run} />
                <Button id='runlots' text='Create 10,000 rows' fn={runLots} />
                <Button id='add' text='Append 1,000 rows' fn={add} />
                <Button id='update' text='Update every 10th row' fn={update} />
                <Button id='clear' text='Clear' fn={clear} />
                <Button id='swaprows' text='Swap Rows' fn={swapRows} />
            </div></div>
        </div></div>
        <table class='table table-hover table-striped test-data'><tbody>
            {List({
                for: () => data,
                each: row => {
                    let rowId = row.id;
                    return <tr $:class={() => isSelected(rowId) ? "danger" : ""}>
                        <td class='col-md-1'>{Text(rowId + '')}</td>
                        <td class='col-md-4'><a on:click={_ => {
                            selected = rowId;
                        }}>{Text(() => row.label)}</a></td>
                        <td class='col-md-1'><a on:click={_ => {
                            remove(rowId);
                        }}><span class='glyphicon glyphicon-remove' aria-hidden="true" /></a></td>
                        <td class='col-md-6' />
                    </tr>
                },
            })}
        </tbody></table>
        <span class='preloadicon glyphicon glyphicon-remove' aria-hidden="true" />
    </div>
}

const view = App();

createApp(view).mount(document.getElementById('main'));
