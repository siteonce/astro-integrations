<script lang="ts">
  // Post cards for the listing and term views. Items come from `createPosts(locale).items`.
  interface Props {
    items: {
      href: string;
      title: string;
      excerpt: string;
      /** ISO timestamp for `<time datetime>`. */
      datetime: string;
      dateLabel: string;
      image?: { src: string; alt: string };
      terms: { href: string; label: string }[];
    }[];
  }

  let { items }: Props = $props();
</script>

<ul>
  {#each items as item (item.href)}
    <li>
      {#if item.image}
        <a href={item.href}><img src={item.image.src} alt={item.image.alt} /></a>
      {/if}
      <h2><a href={item.href}>{item.title}</a></h2>
      <p><time datetime={item.datetime}>{item.dateLabel}</time></p>
      <p>{item.excerpt}</p>
      {#if item.terms.length > 0}
        <ul>
          {#each item.terms as term (term.href)}
            <li><a href={term.href}>{term.label}</a></li>
          {/each}
        </ul>
      {/if}
    </li>
  {/each}
</ul>
