package com.rslsolution.speakmateai.dto.assistant;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response body for {@code POST /api/assistant/message}.
 * Rendered by the frontend widget as markdown + stat cards + optional mini chart
 * + deep-link navigation suggestions.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssistantResponse {

	@Builder.Default
	private boolean success = true;

	private String errorMessage;

	private String markdown;

	private String intent;

	/** True when the question was out of the caller's role scope (graceful denial, no data leak). */
	private boolean accessDenied;

	private String sessionId;

	private List<StatCard> stats;

	private ChartData chart;

	private List<Suggestion> suggestions;

	public static class StatCard {
		private String label;
		private String value;
		private String delta;

		public StatCard() {
		}

		public StatCard(String label, String value) {
			this.label = label;
			this.value = value;
			this.delta = null;
		}

		public StatCard(String label, String value, String delta) {
			this.label = label;
			this.value = value;
			this.delta = delta;
		}

		public String getLabel() {
			return label;
		}

		public void setLabel(String label) {
			this.label = label;
		}

		public String getValue() {
			return value;
		}

		public void setValue(String value) {
			this.value = value;
		}

		public String getDelta() {
			return delta;
		}

		public void setDelta(String delta) {
			this.delta = delta;
		}

		public static Builder builder() {
			return new Builder();
		}

		public static class Builder {
			private String label;
			private String value;
			private String delta;

			public Builder label(String label) {
				this.label = label;
				return this;
			}

			public Builder value(String value) {
				this.value = value;
				return this;
			}

			public Builder delta(String delta) {
				this.delta = delta;
				return this;
			}

			public StatCard build() {
				return new StatCard(label, value, delta);
			}
		}
	}

	public static class ChartData {
		private String type;
		private String title;
		private List<String> labels;
		private List<Dataset> datasets;

		public ChartData() {
		}

		public ChartData(String type, String title, List<String> labels, List<Dataset> datasets) {
			this.type = type;
			this.title = title;
			this.labels = labels;
			this.datasets = datasets;
		}

		public String getType() {
			return type;
		}

		public void setType(String type) {
			this.type = type;
		}

		public String getTitle() {
			return title;
		}

		public void setTitle(String title) {
			this.title = title;
		}

		public List<String> getLabels() {
			return labels;
		}

		public void setLabels(List<String> labels) {
			this.labels = labels;
		}

		public List<Dataset> getDatasets() {
			return datasets;
		}

		public void setDatasets(List<Dataset> datasets) {
			this.datasets = datasets;
		}

		public static Builder builder() {
			return new Builder();
		}

		public static class Builder {
			private String type;
			private String title;
			private List<String> labels;
			private List<Dataset> datasets;

			public Builder type(String type) {
				this.type = type;
				return this;
			}

			public Builder title(String title) {
				this.title = title;
				return this;
			}

			public Builder labels(List<String> labels) {
				this.labels = labels;
				return this;
			}

			public Builder datasets(List<Dataset> datasets) {
				this.datasets = datasets;
				return this;
			}

			public ChartData build() {
				return new ChartData(type, title, labels, datasets);
			}
		}
	}

	public static class Dataset {
		private String label;
		private List<Double> data;

		public Dataset() {
		}

		public Dataset(String label, List<Double> data) {
			this.label = label;
			this.data = data;
		}

		public String getLabel() {
			return label;
		}

		public void setLabel(String label) {
			this.label = label;
		}

		public List<Double> getData() {
			return data;
		}

		public void setData(List<Double> data) {
			this.data = data;
		}

		public static Builder builder() {
			return new Builder();
		}

		public static class Builder {
			private String label;
			private List<Double> data;

			public Builder label(String label) {
				this.label = label;
				return this;
			}

			public Builder data(List<Double> data) {
				this.data = data;
				return this;
			}

			public Dataset build() {
				return new Dataset(label, data);
			}
		}
	}

	public static class Suggestion {
		private String label;
		private String route;
		private String targetRole;

		public Suggestion() {
		}

		public Suggestion(String label, String route, String targetRole) {
			this.label = label;
			this.route = route;
			this.targetRole = targetRole;
		}

		public String getLabel() {
			return label;
		}

		public void setLabel(String label) {
			this.label = label;
		}

		public String getRoute() {
			return route;
		}

		public void setRoute(String route) {
			this.route = route;
		}

		public String getTargetRole() {
			return targetRole;
		}

		public void setTargetRole(String targetRole) {
			this.targetRole = targetRole;
		}

		public static Builder builder() {
			return new Builder();
		}

		public static class Builder {
			private String label;
			private String route;
			private String targetRole;

			public Builder label(String label) {
				this.label = label;
				return this;
			}

			public Builder route(String route) {
				this.route = route;
				return this;
			}

			public Builder targetRole(String targetRole) {
				this.targetRole = targetRole;
				return this;
			}

			public Suggestion build() {
				return new Suggestion(label, route, targetRole);
			}
		}
	}
}
