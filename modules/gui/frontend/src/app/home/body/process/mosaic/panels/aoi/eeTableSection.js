import {Form} from 'widget/form/form'
import {Layout} from 'widget/layout'
import {RecipeActions} from '../../mosaicRecipe'
import {Subject} from 'rxjs'
import {compose} from 'compose'
import {map, takeUntil} from 'rxjs/operators'
import {msg} from 'translate'
import {selectFrom} from 'stateUtils'
import {sepalMap} from 'app/home/map/map'
import {setAoiLayer} from 'app/home/map/aoiLayer'
import {withRecipe} from 'app/home/body/process/recipeContext'
import React from 'react'
import api from 'api'

const mapRecipeToProps = recipe => {
    return {
        recipeId: recipe.id,
        columns: selectFrom(recipe, 'ui.eeTable.columns'),
        rows: selectFrom(recipe, 'ui.eeTable.rows')
    }
}

class EETableSection extends React.Component {
    constructor(props) {
        super(props)
        const {recipeId} = props
        this.eeTableChanged$ = new Subject()
        this.eeTableColumnChanged$ = new Subject()
        this.recipe = RecipeActions(recipeId)
    }

    reset() {
        const {inputs: {eeTableColumn, eeTableRow}} = this.props
        eeTableColumn.set('')
        eeTableRow.set('')
        this.recipe.setEETableColumns(null).dispatch()
        this.recipe.setEETableRows(null).dispatch()
        this.eeTableChanged$.next()
        this.eeTableColumnChanged$.next()
    }

    render() {
        const {allowWholeEETable, inputs: {eeTable}} = this.props
        return (
            <Layout>
                <Form.Input
                    label={msg('process.mosaic.panel.areaOfInterest.form.eeTable.eeTable.label')}
                    autoFocus
                    input={eeTable}
                    placeholder={msg('process.mosaic.panel.areaOfInterest.form.eeTable.eeTable.placeholder')}
                    spellCheck={false}
                    onChangeDebounced={tableId => tableId && this.loadColumns(tableId)}
                    errorMessage
                    busyMessage={this.props.stream('LOAD_EE_TABLE_COLUMNS').active && msg('widget.loading')}
                />
                {allowWholeEETable ? this.renderFilterOptions() : null}
                {this.renderColumnValueRowInputs()}
            </Layout>
        )
    }

    renderFilterOptions() {
        const {inputs: {eeTableRowSelection}} = this.props
        const options = [
            {
                value: 'FILTER',
                label: msg('process.mosaic.panel.areaOfInterest.form.eeTable.eeTableRowSelection.FILTER')
            },
            {
                value: 'INCLUDE_ALL',
                label: msg('process.mosaic.panel.areaOfInterest.form.eeTable.eeTableRowSelection.INCLUDE_ALL')
            }
        ]
        return (
            <Form.Buttons
                input={eeTableRowSelection}
                label={msg('process.mosaic.panel.areaOfInterest.form.eeTable.eeTableRowSelection.label')}
                options={options}
                disabled={!this.hasColumns()}
            />
        )
    }

    renderColumnValueRowInputs() {
        const {
            stream,
            columns,
            rows,
            inputs: {eeTable, eeTableRowSelection, eeTableColumn, eeTableRow}
        } = this.props
        const columnState = stream('LOAD_EE_TABLE_COLUMNS').active
            ? 'loading'
            : this.hasColumns()
                ? 'loaded'
                : 'noEETable'
        const rowState = stream('LOAD_EE_TABLE_ROWS').active
            ? 'loading'
            : rows
                ? (rows.length === 0 ? 'noRows' : 'loaded')
                : eeTable.value
                    ? 'noColumn'
                    : 'noEETable'

        const eeTableColumnDisabled = !this.hasColumns() || eeTableRowSelection.value === 'INCLUDE_ALL'
        const eeTableRowDisabled = !rows || eeTableColumnDisabled

        return (
            <React.Fragment>
                <Form.Combo
                    label={msg('process.mosaic.panel.areaOfInterest.form.eeTable.column.label')}
                    input={eeTableColumn}
                    busy={stream('LOAD_EE_TABLE_COLUMNS').active}
                    disabled={eeTableColumnDisabled}
                    placeholder={msg(`process.mosaic.panel.areaOfInterest.form.eeTable.column.placeholder.${columnState}`)}
                    options={(columns || []).map(column => ({value: column, label: column}))}
                    onChange={column => {
                        // console.log('eeTableColumn onChange')
                        eeTableRow.set('')
                        this.recipe.setEETableRows(null).dispatch()
                        this.eeTableColumnChanged$.next()
                        this.loadDistinctColumnValues(column.value)
                    }}
                    errorMessage
                />
                <Form.Combo
                    label={msg('process.mosaic.panel.areaOfInterest.form.eeTable.row.label')}
                    input={eeTableRow}
                    busy={stream('LOAD_EE_TABLE_ROWS').active}
                    disabled={eeTableRowDisabled}
                    placeholder={msg(`process.mosaic.panel.areaOfInterest.form.eeTable.row.placeholder.${rowState}`)}
                    options={(rows || []).map(value => ({value, label: value}))}
                    errorMessage
                />
            </React.Fragment>
        )
    }

    loadColumns(eeTableId) {
        this.props.stream('LOAD_EE_TABLE_COLUMNS',
            api.gee.loadEETableColumns$(eeTableId).pipe(
                takeUntil(this.eeTableChanged$)),
            columns => this.recipe.setEETableColumns(columns).dispatch(),
            error =>
                this.props.inputs.eeTable.setInvalid(
                    error.response
                        ? msg(error.response.messageKey, error.response.messageData, error.response.defaultMessage)
                        : msg('eeTable.failedToLoad')
                )
        )
    }

    loadDistinctColumnValues(column) {
        this.props.stream('LOAD_EE_TABLE_ROWS',
            api.gee.loadEETableColumnValues$(this.props.inputs.eeTable.value, column).pipe(
                map(values => {
                    this.recipe.setEETableRows(values)
                        .dispatch()
                }
                ),
                takeUntil(this.eeTableColumnChanged$),
                takeUntil(this.eeTableChanged$)
            )
        )
    }

    hasColumns() {
        const {columns} = this.props
        return columns && columns.length > 0
    }

    componentDidMount() {
        const {inputs: {eeTable, eeTableColumn}} = this.props
        if (eeTable.value)
            this.loadColumns(eeTable.value)
        if (eeTableColumn.value)
            this.loadDistinctColumnValues(eeTableColumn.value)
        this.update()
    }

    componentDidUpdate(prevProps) {
        const {inputs: {eeTableRowSelection}} = this.props
        if (!prevProps || prevProps.inputs !== this.props.inputs)
            this.update()
        if (!eeTableRowSelection.value) {
            eeTableRowSelection.set('FILTER')
        }
    }

    update() {
        const {recipeId, inputs: {eeTable, eeTableColumn, eeTableRow}, componentWillUnmount$} = this.props
        setAoiLayer({
            contextId: recipeId,
            aoi: {
                type: 'EE_TABLE',
                id: eeTable.value,
                keyColumn: eeTableColumn.value,
                key: eeTableRow.value
            },
            fill: true,
            destroy$: componentWillUnmount$,
            onInitialized: () => sepalMap.getContext(recipeId).fitLayer('aoi')
        })
    }
}

export default compose(
    EETableSection,
    withRecipe(mapRecipeToProps)
)
