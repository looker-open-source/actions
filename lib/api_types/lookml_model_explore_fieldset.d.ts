import { LookmlModelExploreField } from './lookml_model_explore_field';
export interface LookmlModelExploreFieldset {
    /** Array of dimensions */
    dimensions: LookmlModelExploreField[] | null;
    /** Array of measures */
    measures: LookmlModelExploreField[] | null;
    /** Array of filters */
    filters: LookmlModelExploreField[] | null;
    /** Array of parameters */
    parameters: LookmlModelExploreField[] | null;
}
export interface RequestLookmlModelExploreFieldset {
}
