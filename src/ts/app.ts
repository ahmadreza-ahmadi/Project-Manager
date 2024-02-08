// Project Type
enum ProjectStatus {
	Active,
	Finished,
}

class Project {
	constructor(
		public id: string,
		public title: string,
		public description: string,
		public people: number,
		public status: ProjectStatus
	) {}
}

// Project State Management
type Listener<T> = (items: T[]) => void;

class State<T> {
	protected listeners: Listener<T>[] = [];

	addListener(listenerFn: Listener<T>) {
		this.listeners.push(listenerFn);
	}
}

class ProjectState extends State<Project> {
	private projects: Project[] = [];
	private static instance: ProjectState;

	private constructor() {
		super();
	}

	static getInstance() {
		if (this.instance) {
			return this.instance;
		}
		this.instance = new ProjectState();
		return this.instance;
	}

	addProject(title: string, description: string, numOfPeople: number) {
		const newProject = new Project(
			Math.random().toString(),
			title,
			description,
			numOfPeople,
			ProjectStatus.Active
		);

		this.projects.push(newProject);
		for (const listenerFn of this.listeners) {
			listenerFn(this.projects.slice());
		}
	}
}

const projectState = ProjectState.getInstance();

// Validation
interface Validatable {
	value: string | number;
	required?: boolean;
	minLength?: number;
	maxLength?: number;
	min?: number;
	max?: number;
}

function validate(validatableInput: Validatable) {
	let isValid = true;

	const { value, required, minLength, maxLength, min, max } = validatableInput;

	if (required) {
		isValid = isValid && value.toString().trim().length !== 0;
	}

	if (typeof value === 'string' && minLength != null) {
		isValid = isValid && value.length >= minLength;
	}

	if (typeof value === 'string' && maxLength != null) {
		isValid = isValid && value.length <= maxLength;
	}

	if (typeof value === 'number' && min != null) {
		isValid = isValid && value >= min;
	}

	if (typeof value === 'number' && max != null) {
		isValid = isValid && value <= max;
	}

	return isValid;
}

// Autobind Decorator
function autobind(_target: any, _methodName: string, descriptor: PropertyDescriptor) {
	const originalMethod = descriptor.value;
	const adjustedDescriptor: PropertyDescriptor = {
		configurable: true,
		get() {
			return originalMethod.bind(this);
		},
	};
	return adjustedDescriptor;
}

// Component Base Class
abstract class Component<T extends HTMLElement, U extends HTMLElement> {
	templateElement: HTMLTemplateElement;
	hostElement: T;
	element: U;

	constructor(
		templateId: string,
		hostElementId: string,
		private insertAtStart: boolean,
		newElementId?: string
	) {
		this.templateElement = document.getElementById(templateId) as HTMLTemplateElement;
		this.hostElement = document.getElementById(hostElementId) as T;

		const importedNode = document.importNode(this.templateElement.content, true);
		this.element = importedNode.firstElementChild as U;
		if (newElementId) this.element.id = newElementId;

		this.attach();
	}

	private attach() {
		this.hostElement.insertAdjacentElement(
			this.insertAtStart ? 'afterbegin' : 'beforeend',
			this.element
		);
	}

	abstract configure(): void;
	abstract renderContent(): void;
}

// ProjectList Class
class ProjectList extends Component<HTMLDivElement, HTMLElement> {
	assignedProjects: Project[];

	constructor(private type: 'active' | 'finished') {
		super('project-list', 'app', false, `${type}-projects`);

		this.assignedProjects = [];

		this.configure();
		this.renderContent();
	}

	configure(): void {
		projectState.addListener((projects: Project[]) => {
			const relevantProjects = projects.filter(project => {
				if (this.type === 'active') {
					return project.status === ProjectStatus.Active;
				}
				return project.status === ProjectStatus.Finished;
			});
			this.assignedProjects = relevantProjects;
			this.renderProjects();
		});
	}

	renderContent() {
		const listId = `${this.type}-projects-list`;
		this.element.querySelector('ul')!.id = listId;

		this.element.querySelector('h2')!.textContent = `${this.type.toUpperCase()} PROJECTS`;
	}

	private renderProjects() {
		const listEl = document.getElementById(`${this.type}-projects-list`) as HTMLUListElement;
		listEl.innerHTML = '';
		for (const projectItem of this.assignedProjects) {
			const listItem = document.createElement('li');
			listItem.textContent = projectItem.title;
			listEl.appendChild(listItem);
		}
	}
}

// ProjectInput Class
class ProjectInput extends Component<HTMLDivElement, HTMLFormElement> {
	titleInputElement: HTMLInputElement;
	descriptionInputElement: HTMLInputElement;
	peopleInputElement: HTMLInputElement;

	constructor() {
		super('project-input', 'app', true, 'user-input');

		this.titleInputElement = this.element.querySelector('#title') as HTMLInputElement;
		this.descriptionInputElement = this.element.querySelector('#description') as HTMLInputElement;
		this.peopleInputElement = this.element.querySelector('#people') as HTMLInputElement;

		this.configure();
	}

	configure() {
		this.element.addEventListener('submit', this.submitHandler);
	}

	renderContent() {}

	private gatherUserInput(): [string, string, number] | void {
		const enteredTitle = this.titleInputElement.value;
		const enteredDescription = this.descriptionInputElement.value;
		const enteredPeople = this.peopleInputElement.value;

		const titleValidatable: Validatable = { value: enteredTitle, required: true };
		const descriptionValidatable: Validatable = {
			value: enteredDescription,
			required: true,
			minLength: 5,
		};
		const peopleValidatable: Validatable = {
			value: +enteredPeople,
			required: true,
			min: 1,
			max: 5,
		};

		if (
			!validate(titleValidatable) ||
			!validate(descriptionValidatable) ||
			!validate(peopleValidatable)
		) {
			alert('Invalid input, please try again!');
		} else {
			return [enteredTitle, enteredDescription, +enteredPeople];
		}
	}

	private clearInputs() {
		this.titleInputElement.value = '';
		this.descriptionInputElement.value = '';
		this.peopleInputElement.value = '';
	}

	@autobind
	private submitHandler(event: Event) {
		event.preventDefault();

		const userInput = this.gatherUserInput();

		if (Array.isArray(userInput)) {
			const [title, description, people] = userInput;
			projectState.addProject(title, description, people);
			this.clearInputs();
		}
	}
}

const projectInput = new ProjectInput();
const activeProjectList = new ProjectList('active');
const finishedProjectList = new ProjectList('finished');
