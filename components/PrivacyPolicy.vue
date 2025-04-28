<template>
	<main class="w-full p-8 space-y-6">
		<header>
			<h1 class="text-4xl font-extrabold text-white">Privacy Policy</h1>
			<p class="mt-2 text-lg text-gray-300">
				This Privacy Policy outlines how we collect, use, and handle your information when you interact with our
				website and web applications.
			</p>
		</header>

		<section class="space-y-4">
			<h2 class="text-2xl font-bold text-white">Information Collection</h2>
			<p class="text-gray-300">
				We do not actively collect personal data beyond what is required for secure authentication. When you log in
				using a third-party provider such as <strong>Discord</strong> or <strong>Google</strong>, we temporarily access
				the following details:
			</p>
			<ul class="list-disc list-inside text-gray-300 pl-4">
				<li>Email address</li>
				<li>Display name (username)</li>
				<li>Profile image</li>
			</ul>
			<p class="text-gray-400 text-sm italic">This information is only used during your active session for identification and display purposes.</p>
		</section>

		<section class="space-y-4">
			<h2 class="text-2xl font-bold text-white">Data Storage</h2>
			<p class="text-gray-300">
				We do not store your personal information in our databases unless explicitly required for functionality.
				Session data is ephemeral and only maintained for the duration of your active session.
			</p>
		</section>

		<section class="space-y-4">
			<h2 class="text-2xl font-bold text-white">Analytics & Tracking</h2>
			<p class="text-gray-300">
				We do not use third-party analytics tools, advertising trackers, or behavioral monitoring technologies.
				Your activity on our site remains private and untracked.
			</p>
		</section>

		<section class="space-y-4">
			<h2 class="text-2xl font-bold text-white">Third-Party Authentication</h2>
			<p class="text-gray-300">
				Authentication is provided through third-party platforms (e.g., Discord, Google). These providers may collect
				and manage your data in accordance with their own privacy policies. We recommend reviewing those policies
				for further details on how your data is handled by those services.
			</p>
		</section>

		<section class="space-y-4">
			<h2 class="text-2xl font-bold text-white">Policy Updates</h2>
			<p class="text-gray-300">
				This Privacy Policy may be updated periodically to reflect changes in our practices or applicable regulations.
				Revisions will be posted on this page with an updated revision date.
			</p>
		</section>
	</main>
</template>

<script setup>
useHead({
	title: 'Privacy Policy | Unfit for Print'
})
</script>

<style scoped>
/* Add any component-specific styles here if needed */
</style>