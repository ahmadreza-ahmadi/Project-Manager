interface Draggable {
	dragStratHandler(event: DragEvent): void;
	dragEndHandler(event: DragEvent): void;
}

interface DragTarget {
	dragOverHandler(event: DragEvent): void;
	dropHandler(event: DragEvent): void;
	dragLeaveHandler(event: DragEvent): void;
}

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
		this.updateListeners();
	}

	moveProject(projectId: string, newStatus: ProjectStatus) {
		const targetProject = this.projects.find(project => projectId === project.id);
		if (targetProject && targetProject.status !== newStatus) {
			targetProject.status = newStatus;
			this.updateListeners();
		}
	}

	private updateListeners() {
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

// ProjectItem Class
class ProjectItem extends Component<HTMLUListElement, HTMLLinkElement> implements Draggable {
	private project: Project;

	get persons() {
		if (this.project.people === 1) {
			return '1 person';
		} else {
			return `${this.project.people} persons`;
		}
	}

	constructor(hostId: string, project: Project) {
		super('single-project', hostId, false, project.id);
		this.project = project;

		this.configure();
		this.renderContent();
	}

	@autobind
	dragStratHandler(event: DragEvent) {
		event.dataTransfer?.setData('text/plain', this.project.id);
		event.dataTransfer!.effectAllowed = 'move';
	}

	dragEndHandler(_: DragEvent) {
		console.log('Drag end');
	}

	configure() {
		this.element.addEventListener('dragstart', this.dragStratHandler);
		this.element.addEventListener('dragend', this.dragEndHandler);
	}

	renderContent() {
		this.element.querySelector('h2')!.textContent = this.project.title;
		this.element.querySelector('h3')!.textContent = this.persons + ' assigned';
		this.element.querySelector('p')!.textContent = this.project.description;
	}
}

// ProjectList Class
class ProjectList extends Component<HTMLDivElement, HTMLElement> implements DragTarget {
	assignedProjects: Project[];

	constructor(private type: 'active' | 'finished') {
		super('project-list', 'app', false, `${type}-projects`);

		this.assignedProjects = [];

		this.configure();
		this.renderContent();
	}

	@autobind
	dragOverHandler(event: DragEvent) {
		if (event.dataTransfer && event.dataTransfer.types[0] === 'text/plain') {
			event.preventDefault();
			const listEl = this.element.querySelector('ul')!;
			listEl.classList.add('droppable');
		}
	}

	@autobind
	dropHandler(event: DragEvent) {
		const projectId = event.dataTransfer!.getData('text/plain');
		const projectStatus = this.type === 'active' ? ProjectStatus.Active : ProjectStatus.Finished;
		projectState.moveProject(projectId, projectStatus);
	}

	@autobind
	dragLeaveHandler(_: DragEvent) {
		const listEl = this.element.querySelector('ul')!;
		listEl.classList.remove('droppable');
	}

	configure() {
		this.element.addEventListener('dragover', this.dragOverHandler);
		this.element.addEventListener('dragleave', this.dragLeaveHandler);
		this.element.addEventListener('drop', this.dropHandler);

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
			new ProjectItem(this.element.querySelector('ul')!.id, projectItem);
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
